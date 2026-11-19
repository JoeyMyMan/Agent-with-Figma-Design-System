/**
 * dsh-figma-ds — Host half.
 *
 * Wraps the `ds-workflow` toolkit (this repository: `lib/`, `bin/`,
 * `playbooks/`, `templates/`, `figma/`) as a DeepSeek Harness plugin: the same eight commands, but callable from the Web
 * UI page and returning structured JSON instead of human-readable terminal text.
 *
 * Everything the CLI does lives in the repository's lib/ modules; this file only
 *
 *   1. resolves which project directory the page may read and write,
 *   2. reads the repository state (config / lock / tokens / registry / review),
 *   3. runs one command at a time against that directory, serialised per
 *      directory (the toolkit writes files without a lock), and
 *   4. serves it all over authenticated exact Fetch routes below /api.
 *
 * The Figma side (export script, write-back, designer review reminders) stays an
 * MCP operation: the page shows the command and the playbook that performs it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { delimiter, isAbsolute, join, resolve } from 'node:path'

import { CONFIG_FILE, loadConfig, paths } from '../../lib/config.mjs'
import { init } from '../../lib/init.mjs'
import { buildProject } from '../../lib/build.mjs'
import { check, updateBaseline } from '../../lib/check.mjs'
import { renderProject } from '../../lib/registry.mjs'
import { checkLedger, readLedger, reviewSummary } from '../../lib/review.mjs'
import { PKG, VERSION, playbookList, writeRules } from '../../lib/rules.mjs'
import { describeSource, nextSteps, resolveSource } from '../../lib/source.mjs'
import { fromHtml } from '../../lib/html.mjs'
import { mergeExports, originOf, pin, readExports } from '../../lib/sync.mjs'
import { sha256, writeJson } from '../../lib/util.mjs'

const PLUGIN_ID = 'dsh-figma-ds'
/** Route prefix on the shared, authenticated API channel. */
const API = '/api/figma-ds'
const MANIFEST = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const MAX_TOKENS = 1200
const MAX_REGISTRY = 300
const MAX_EXPORT_FILES = 40

/** Directory names that never hold a project the page should adopt. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', 'templates', 'template', 'examples', 'fixtures', 'playbooks', 'test', 'tests', 'coverage'])

// ---------------------------------------------------------------------------
// Project directories the page may touch
// ---------------------------------------------------------------------------

/**
 * Roots the page is allowed to read and write. This is a deliberate allowlist:
 * the Host half runs unsandboxed, so the page never names an arbitrary path.
 * Every registered Harness workspace is a root — a project normally lives in
 * one — and `DSW_PROJECT_DIR` (one directory) / `DSW_PROJECT_DIRS` (several,
 * separated by the platform path delimiter) extend the list for projects
 * outside the workspace.
 */
function allowedRoots(ctx) {
  const roots = []
  const push = (value) => {
    if (!value || typeof value !== 'string') return
    try {
      const abs = resolve(value.trim())
      if (existsSync(abs) && statSync(abs).isDirectory()) roots.push(abs)
    } catch {
      /* ignore an unusable entry */
    }
  }
  push(process.env.DSW_PROJECT_DIR)
  try {
    const registry = ctx?.get?.('workspaceRegistry')
    if (registry && typeof registry.list === 'function') {
      for (const workspace of registry.list()) push(workspace?.path)
    }
  } catch {
    /* registry absent: fall back below */
  }
  for (const value of String(process.env.DSW_PROJECT_DIRS ?? '').split(delimiter)) push(value)
  if (!roots.length) {
    try {
      push(ctx?.get?.('workingDirectory')?.defaultDirectory)
    } catch {
      /* ignore */
    }
  }
  if (!roots.length) push(process.cwd())
  return [...new Set(roots)]
}

const inside = (root, target) => {
  if (target === root) return true
  const prefix = root.endsWith('/') ? root : `${root}/`
  return target.startsWith(prefix)
}

function resolveDir(ctx, requested) {
  const roots = allowedRoots(ctx)
  const target = requested ? resolve(requested) : roots[0]
  if (!target) throw new Error('没有可用的项目目录：请把工作区或 DSW_PROJECT_DIR 指向一个项目')
  if (!roots.some((root) => inside(root, target))) {
    throw new Error(`目录不在允许范围内：${target}`)
  }
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`目录不存在：${target}`)
  return { dir: target, roots }
}

/**
 * Every project the page offers: every allowlist root, plus the direct children
 * of a root that already carry `design-system.config.json`. Only one level is
 * scanned on purpose — a whole-disk walk would cost more than it finds, and a
 * project is normally a workspace's own directory or one level inside it.
 */
function listProjects(ctx) {
  const roots = allowedRoots(ctx)
  const projects = []
  const seen = new Set()
  const add = (dir, root) => {
    if (seen.has(dir) || projects.length >= 80) return
    seen.add(dir)
    const configured = existsSync(join(dir, CONFIG_FILE))
    if (!configured && !root) return
    let name = ''
    let synced = false
    if (configured) {
      try {
        const cfg = loadConfig(dir)
        name = cfg.designSystem.name ?? ''
        synced = existsSync(join(dir, paths.lock))
      } catch {
        name = ''
      }
    }
    projects.push({ path: dir, name: name || dir.split('/').filter(Boolean).pop() || dir, initialized: configured, synced, root })
  }
  for (const root of roots) add(root, true)
  for (const root of roots) {
    let entries = []
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    let scanned = 0
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      if (++scanned > 200) break
      const child = join(root, entry.name)
      if (existsSync(join(child, CONFIG_FILE))) add(child, false)
    }
  }
  // The most useful entry first: set up beats a bare root, and a synced project beats an empty one.
  projects.sort(
    (a, b) => Number(b.initialized) - Number(a.initialized) || Number(b.synced) - Number(a.synced) || Number(b.root) - Number(a.root),
  )
  return { roots, projects }
}

// ---------------------------------------------------------------------------
// Repository state (read-only)
// ---------------------------------------------------------------------------

const readJsonSafe = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const countBy = (list, key) =>
  list.reduce((out, item) => {
    const value = item?.[key] ?? 'unknown'
    out[value] = (out[value] ?? 0) + 1
    return out
  }, {})

function agentRuleState(dir) {
  const agentsFile = join(dir, 'AGENTS.md')
  const text = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : ''
  const marker = '<!-- ds-workflow:start'
  const at = text.indexOf(marker)
  const version = at >= 0 ? /generated by `npx ds-workflow rules`;\s*(?:[\s\S]*?)ds-workflow (\d+\.\d+\.\d+)/.exec(text.slice(at, at + 600))?.[1] : undefined
  return {
    path: agentsFile,
    exists: existsSync(agentsFile),
    managedBlock: at >= 0,
    version: version ?? (at >= 0 ? '?' : undefined),
    targets: [
      { id: 'cursor', path: '.cursor/rules/ds-workflow.mdc' },
      { id: 'copilot', path: '.github/instructions/ds-workflow.instructions.md' },
      { id: 'claude', path: 'CLAUDE.md' },
      { id: 'gemini', path: 'GEMINI.md' },
      { id: 'cline', path: '.clinerules/ds-workflow.md' },
    ].map((target) => ({ ...target, exists: existsSync(join(dir, target.path)) })),
  }
}

function readState(dir) {
  const cfg = loadConfig(dir)
  const initialized = cfg.found
  const lock = readJsonSafe(join(dir, paths.lock))
  const names = readJsonSafe(join(dir, paths.names))
  const registryRaw = readJsonSafe(join(dir, paths.registry))
  const ledger = initialized ? readLedger(cfg, dir) : null
  const ledgerErrors = ledger ? checkLedger(cfg, dir) : []

  const tokenEntries = Object.entries(names?.names ?? {})
  const tokens = tokenEntries.slice(0, MAX_TOKENS).map(([name, meta]) => ({
    name,
    figma: meta?.figma ?? '',
    group: meta?.group ?? '',
    status: meta?.status ?? '',
  }))
  const components = (registryRaw?.components ?? []).slice(0, MAX_REGISTRY).map((entry) => ({
    code: entry.code ?? '',
    status: entry.status ?? '',
    description: entry.description ?? '',
    screens: entry.screens ?? [],
    variants: entry.variants ?? null,
    figma: entry.figma ?? null,
    figmaProposal: entry.figmaProposal ?? null,
    figmaPending: entry.figmaPending ?? null,
    note: entry.note ?? '',
    issue: entry.issue ?? '',
  }))

  const cssFile = join(dir, cfg.tokens.css)
  const registryMd = join(dir, cfg.registry.markdown)

  return {
    dir,
    initialized,
    config: {
      file: CONFIG_FILE,
      name: cfg.designSystem.name,
      tokensPrefix: cfg.tokens.prefix,
      tokensCss: cfg.tokens.css,
      proposedTokens: cfg.tokens.proposed,
      proposalPrefix: cfg.proposal.prefix,
      proposalPage: cfg.designSystem.proposalPage,
      screensPage: cfg.designSystem.screensPage,
      registryMarkdown: cfg.registry.markdown,
      playbooksDir: cfg.playbooks.dir,
      checkScan: cfg.check.scan,
      componentDirs: cfg.check.componentDirs,
      agentsTargets: cfg.agents.targets,
      reviewChannel: cfg.review.channel,
      reviewLedger: cfg.review.ledger,
      readyMarker: cfg.review.readyMarker,
    },
    source: cfg.designSystem.source,
    sourceLabel: describeSource(cfg.designSystem.source),
    steps: initialized ? nextSteps(cfg.designSystem.source) : [],
    lock: lock
      ? {
          label: lock.label ?? '',
          source: lock.source ?? '',
          date: lock.date ?? '',
          warning: lock.warning ?? '',
          counts: lock.counts ?? {},
          origin: lock.origin ?? null,
        }
      : null,
    tokens: {
      label: names?.label ?? '',
      prefix: names?.prefix ?? cfg.tokens.prefix,
      total: tokenEntries.length,
      shown: tokens.length,
      truncated: tokenEntries.length > tokens.length,
      groups: countBy(tokens, 'group'),
      statuses: countBy(tokens, 'status'),
      entries: tokens,
      cssExists: existsSync(cssFile),
      cssBytes: existsSync(cssFile) ? statSync(cssFile).size : 0,
      proposedExists: existsSync(join(dir, cfg.tokens.proposed)),
    },
    registry: {
      exists: !!registryRaw,
      file: paths.registry,
      markdown: cfg.registry.markdown,
      markdownExists: existsSync(registryMd),
      total: registryRaw?.components?.length ?? 0,
      counts: countBy(registryRaw?.components ?? [], 'status'),
      entries: components,
    },
    review: {
      exists: !!ledger,
      file: cfg.review.ledger,
      ready: ledger?.ready ?? [],
      unconfirmed: ledger?.unconfirmed ?? [],
      pending: ledger?.pending ?? [],
      queue: ledger?.reviewQueue ?? null,
      errors: ledgerErrors,
      strictPassed: !!ledger && ledgerErrors.length === 0 && (ledger?.pending ?? []).length === 0,
    },
    agentRules: agentRuleState(dir),
    playbooks: playbookList().map((book) => ({ dir: book.dir, name: book.name, description: book.description })),
    files: {
      config: existsSync(join(dir, CONFIG_FILE)),
      lock: existsSync(join(dir, paths.lock)),
      tokens: existsSync(join(dir, paths.tokens)),
      inventory: existsSync(join(dir, paths.inventory)),
      registry: existsSync(join(dir, paths.registry)),
      baseline: existsSync(join(dir, cfg.check.baseline)),
      ci: existsSync(join(dir, '.github/workflows/ds-check.yml')),
      playbooksCopy: existsSync(join(dir, cfg.playbooks.dir)),
      handoff: existsSync(join(dir, 'docs/design/handoff-design-system.md')),
    },
    versions: { plugin: MANIFEST.version, toolkit: VERSION },
  }
}

function readPlaybook(name) {
  const books = playbookList()
  const book = books.find((entry) => entry.dir === name)
  if (!book) throw new Error(`没有这个手册：${name}`)
  const text = readFileSync(join(PKG, 'playbooks', book.dir, 'SKILL.md'), 'utf8')
  return { name: book.dir, title: book.name, description: book.description, markdown: text }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const ok = (lines, extra = {}) => ({ ok: true, code: 0, lines, ...extra })
const bad = (lines, extra = {}) => ({ ok: false, code: 1, lines, ...extra })
const out = (text) => ({ level: 'out', text: String(text) })
const err = (text) => ({ level: 'err', text: String(text) })

/** design-system/source/figma-export.*.json, newest first — what `sync` reads without --export. */
function listExports(dir) {
  const sourceDir = join(dir, paths.sourceDir)
  if (!existsSync(sourceDir)) return []
  return readdirSync(sourceDir)
    .filter((file) => /^figma-export\..*\.json$/.test(file))
    .slice(0, MAX_EXPORT_FILES)
    .map((file) => join(paths.sourceDir, file))
}

function runInit(dir, args) {
  const result = init(dir, {
    name: args.name || undefined,
    prefix: args.prefix || undefined,
    source: args.source || undefined,
    sourceOpts: {},
    agents: args.agents || undefined,
    reviewChannel: args.reviewChannel || undefined,
    force: !!args.force,
  })
  const lines = [out(`created / updated:\n  ${result.created.join('\n  ') || '(nothing)'}`)]
  if (result.skipped.length) lines.push(out(`kept (already there):\n  ${result.skipped.join('\n  ')}`))
  const cfg = loadConfig(dir)
  lines.push(out(`source: ${describeSource(cfg.designSystem.source)}`))
  lines.push(out(`next:\n  ${nextSteps(cfg.designSystem.source).join('\n  ')}`))
  return ok(lines)
}

function runSource(dir, args) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  let source = cfg.designSystem.source
  const lines = []
  if (args.source) {
    source = resolveSource(args.source, {
      library: !!args.library,
      fromCommunity: args.fromCommunity || undefined,
      license: args.license || undefined,
      components: args.components || undefined,
      workFile: args.workFile || undefined,
      root: dir,
    })
    const file = join(dir, CONFIG_FILE)
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    raw.designSystem = { ...raw.designSystem, source }
    delete raw.designSystem.figmaFileKey
    writeJson(file, raw)
    writeRules(loadConfig(dir), { root: dir })
    lines.push(out(`${CONFIG_FILE}: designSystem.source 已更新，agent 规则已刷新`))
  }
  lines.push(out(`source: ${describeSource(source)}`))
  lines.push(out(`next:\n  ${nextSteps(source).join('\n  ')}`))
  return ok(lines)
}

function runSync(dir, args) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const source = cfg.designSystem.source
  const exportFiles = listExports(dir)
  const htmlFile = args.html || (source?.kind === 'html' ? source.html : null)
  let exp
  let origin
  let from
  if (htmlFile) {
    const abs = join(dir, htmlFile)
    if (!existsSync(abs)) return bad([err(`读不到 HTML 导出：${htmlFile}`)])
    const buf = readFileSync(abs)
    const fromPage = fromHtml(buf.toString('utf8'))
    const parts = exportFiles.map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')))
    if (parts.some((part) => part.variables?.length || part.paintStyles?.length || part.textStyles?.length || part.effectStyles?.length)) {
      return bad([err('token 来自 HTML 导出：--html 只能搭配 components 导出（PART = components）')])
    }
    exp = parts.length ? { ...mergeExports([...parts, { ...fromPage, components: fromPage.components ?? [] }]), source: 'html' } : fromPage
    if (!exp.fileName) exp.fileName = cfg.designSystem.name
    from = `html${parts.length ? ` + plugin-export (${parts.length} components file(s))` : ''}`
    origin = originOf(source?.kind === 'html' ? source : { kind: 'html', html: htmlFile }, { htmlSha256: sha256(buf) })
  } else if (exportFiles.length) {
    exp = readExports(exportFiles.map((file) => join(dir, file)))
    from = `plugin-export (${exportFiles.length} file(s))`
  } else {
    return bad([
      err('没有可同步的来源'),
      out(`Figma 来源需要先用 Figma MCP 的 use_figma 跑 docs/ds-workflow/figma/export-design-system.js，把导出的 JSON 存到 ${paths.sourceDir}/，再点同步。`),
      out(`current source: ${describeSource(source)}`),
    ])
  }
  const result = pin(cfg, exp, { label: args.label || undefined, source: from, origin, root: dir })
  const lines = [out(`${result.lock.label}: ${JSON.stringify(result.lock.counts)} pinned`)]
  if (result.report) lines.push(out(`upgrade report → ${result.report}`))
  if (result.lock.warning) lines.push(err(`warning: ${result.lock.warning}`))
  lines.push(out('next: build → check'))
  return ok(lines)
}

function runBuild(dir) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const result = buildProject(cfg, dir)
  const by = Object.entries(result.by ?? {}).map(([key, value]) => `${key}: ${value}`).join(', ')
  return ok([out(`${result.css}: ${result.count} tokens`), out(by || '(none)')])
}

function runCheck(dir, args) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const result = check(cfg, dir)
  if (args.update) updateBaseline(cfg, result.counts, dir)
  const literals = Object.values(result.counts ?? {}).reduce((sum, value) => sum + (value.colors ?? 0) + (value.legacyLiterals ?? 0), 0)
  const hard = args.update ? result.errors.filter((line) => !/\(baseline \d+\)/.test(line)) : result.errors
  const lines = hard.map((line) => err(`✗ ${line}`))
  if (args.update) lines.push(out(`baseline 已更新（${Object.keys(result.counts ?? {}).length} 个有字面量的文件）`))
  lines.push(out(`${result.files} files checked · ${literals} literal(s) still to migrate · ${hard.length} error(s)`))
  return { ...(hard.length ? bad(lines) : ok(lines)), errors: hard, files: result.files, literals }
}

function runRegistry(dir) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const result = renderProject(cfg, dir)
  return ok([out(`${result.file}: ${result.count} components`)])
}

function runReview(dir, args) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const errors = checkLedger(cfg, dir)
  const summary = reviewSummary(cfg, dir)
  const lines = summary.text.split('\n').map((line) => out(line))
  for (const line of errors) lines.push(err(`✗ ${line}`))
  if (args.strict && summary.pending) lines.push(err(`✗ ${summary.pending} change(s) still waiting for the designer's review`))
  const failed = errors.length > 0 || (!!args.strict && summary.pending > 0)
  return { ...(failed ? bad(lines) : ok(lines)), summary: { pending: summary.pending, errors } }
}

function runRules(dir, args) {
  const cfg = loadConfig(dir)
  if (!cfg.found) return bad([err(`${CONFIG_FILE} 不存在，先运行 init`)])
  const skillsDirs = String(args.skillsDirs ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const written = writeRules(cfg, { root: dir, skillsDirs })
  return ok([out(`updated:\n  ${written.join('\n  ')}`)])
}

function runPaths() {
  return ok([
    out(`package:   ${PKG}`),
    out(`playbooks: ${join(PKG, 'playbooks')}`),
    out(`export:    ${join(PKG, 'figma/export-design-system.js')}`),
    out(`plugin:    ${MANIFEST.version} · toolkit ${VERSION}`),
  ])
}

const COMMANDS = {
  init: runInit,
  source: runSource,
  sync: runSync,
  build: runBuild,
  check: runCheck,
  registry: runRegistry,
  review: runReview,
  rules: runRules,
  paths: runPaths,
}

// The toolkit writes with plain writeFileSync and has no lock: one command per directory at a time.
const queues = new Map()
function withDirLock(dir, operation) {
  const previous = queues.get(dir) ?? Promise.resolve()
  const next = previous.then(operation, operation)
  queues.set(
    dir,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}

async function runCommand(dir, request) {
  const command = request.command
  const handler = COMMANDS[command]
  if (!handler) return bad([err(`未知命令：${command}`)])
  const started = Date.now()
  try {
    const result = await withDirLock(dir, async () => handler(dir, request.args ?? {}))
    return { ...result, command, dir, ms: Date.now() - started }
  } catch (error) {
    return { ok: false, code: 1, command, dir, ms: Date.now() - started, lines: [err(error?.message ?? String(error))] }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function body(request) {
  try {
    const text = await request.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

function routesFor(ctx) {
  const guard = (handler) => async (request) => {
    try {
      const payload = await body(request)
      const { dir } = resolveDir(ctx, payload.dir)
      return json(await handler(dir, payload))
    } catch (error) {
      return json({ ok: false, error: error?.message ?? String(error) }, 400)
    }
  }

  return [
    {
      path: `${API}/dirs`,
      methods: ['GET', 'POST'],
      handler: async () => json({ ok: true, value: listProjects(ctx) }),
    },
    {
      path: `${API}/state`,
      methods: ['POST'],
      handler: guard(async (dir) => ({ ok: true, value: readState(dir) })),
    },
    {
      path: `${API}/run`,
      methods: ['POST'],
      handler: guard(async (dir, payload) => ({ ok: true, value: await runCommand(dir, payload) })),
    },
    {
      path: `${API}/playbook`,
      methods: ['POST'],
      handler: async (request) => {
        try {
          const payload = await body(request)
          return json({ ok: true, value: readPlaybook(String(payload.name ?? '')) })
        } catch (error) {
          return json({ ok: false, error: error?.message ?? String(error) }, 400)
        }
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Plugin entry
// ---------------------------------------------------------------------------

export const name = PLUGIN_ID

/** The Web GUI is the only consumer; no other Service is a hard dependency. */
export const inject = []

export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = scope.connection
    if (!connection || typeof connection.fetch?.register !== 'function') {
      throw new Error(`${PLUGIN_ID}: 当前 Harness 没有 connection.fetch，页面无法与 Host 通信`)
    }
    for (const route of routesFor(ctx)) {
      scope.effect(
        () =>
          connection.fetch.register({
            path: route.path,
            methods: route.methods,
            requestBody: 'buffered',
            fetch: async (request) => {
              try {
                return await route.handler(request)
              } catch (error) {
                return json({ ok: false, error: error?.message ?? String(error) }, 500)
              }
            },
          }),
        `${PLUGIN_ID}: ${route.path}`,
      )
    }
  })
}

/** Exposed for `tests/smoke.mjs`; not part of the plugin contract. */
export const __internals = {
  allowedRoots,
  listProjects,
  readState,
  readPlaybook,
  runCommand,
  resolveDir,
  MANIFEST,
  VERSION,
}
