// Host-half smoke test: exercises the same functions the Web UI page calls,
// without a Harness. Run with `node tests/smoke.mjs [projectDir]`.
//
// The default project is examples/xiaohuanxiong-ds, committed with a pinned
// version so the assertions below are deterministic.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __internals } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const pluginDir = resolve(here, '..')
const exampleDir = resolve(pluginDir, '..', '..', 'examples', 'xiaohuanxiong-ds')
const demoDir = resolve(process.argv[2] ?? exampleDir)

assert.ok(existsSync(join(demoDir, 'design-system.config.json')), `example project missing at ${demoDir}`)
process.env.DSW_PROJECT_DIR = demoDir

const results = []
function check(name, fn) {
  try {
    fn()
    results.push({ name, status: 'ok' })
  } catch (error) {
    results.push({ name, status: 'failed', error: error?.message ?? String(error) })
  }
}

const { listProjects, readState, readPlaybook, runCommand, resolveDir, VERSION } = __internals
const ctx = { get: () => undefined }

check('toolkit version is the repository version', () => assert.match(VERSION, /^\d+\.\d+\.\d+$/))

check('allowed roots include DSW_PROJECT_DIR', () => {
  const roots = __internals.allowedRoots(ctx)
  assert.ok(roots.includes(demoDir), `roots: ${roots.join(', ')}`)
})

check('a directory outside the allowlist is refused', () => {
  assert.throws(() => resolveDir(ctx, '/etc'), /不在允许范围/)
})

check('the project list finds the example project', () => {
  const { projects } = listProjects(ctx)
  const entry = projects.find((project) => project.path === demoDir)
  assert.ok(entry, 'example project not listed')
  assert.equal(entry.initialized, true)
  assert.equal(entry.name, '小浣熊教育版设计系统')
})

const state = readState(demoDir)
check('state: config + source', () => {
  assert.equal(state.initialized, true)
  assert.equal(state.config.tokensPrefix, 'xhx')
  assert.equal(state.source.fileKey, 'lmbRXNuIp0ZsJ4LI32T2ZK')
  assert.match(state.sourceLabel, /Figma file/)
})

check('state: pinned version and tokens', () => {
  assert.equal(state.lock.label, 'DS-2026-11-15')
  assert.equal(state.lock.counts.variables, 268)
  assert.equal(state.lock.counts.components, 265)
  assert.equal(state.tokens.total, 410)
  assert.equal(state.tokens.groups.variables, 268)
  assert.equal(state.tokens.groups.paint, 10)
  assert.equal(state.tokens.groups.text, 116)
  assert.equal(state.tokens.groups.effect, 16)
  assert.ok(state.tokens.cssExists)
})

check('state: registry + review ledger', () => {
  assert.equal(state.registry.total, 5)
  assert.equal(state.registry.counts.reuse, 1)
  assert.equal(state.registry.counts.approved, 1)
  assert.equal(state.registry.counts.extend, 1)
  assert.equal(state.registry.counts.proposed, 1)
  assert.equal(state.registry.counts.deprecated, 1)
  assert.equal(state.review.ready.length, 1)
  assert.equal(state.review.unconfirmed.length, 1)
  assert.equal(state.review.pending.length, 1)
  assert.equal(state.review.errors.length, 0)
  assert.equal(state.review.strictPassed, false)
})

check('state: agent rules and playbooks', () => {
  assert.equal(state.agentRules.managedBlock, true)
  assert.ok(state.agentRules.version, 'managed block version')
  assert.equal(state.playbooks.length, 8)
})

check('playbook content is the bundled SKILL.md', () => {
  const book = readPlaybook('ds-implement')
  assert.equal(book.name, 'ds-implement')
  assert.match(book.markdown, /^---/)
  assert.throws(() => readPlaybook('../../etc/passwd'), /没有这个手册/)
})

const runs = []
async function run(command, args) {
  const result = await runCommand(demoDir, { command, args })
  runs.push({ command, result })
  return result
}

await (async () => {
  const checkResult = await run('check')
  check('check reports the drifting component', () => {
    assert.equal(checkResult.ok, false)
    assert.equal(checkResult.code, 1)
    assert.ok(checkResult.errors.some((line) => line.includes('LoginButton.tsx')), JSON.stringify(checkResult.errors))
  })

  const review = await run('review')
  check('review passes without strict', () => assert.equal(review.ok, true))

  const strict = await run('review', { strict: true })
  check('review --strict fails while a change waits', () => {
    assert.equal(strict.ok, false)
    assert.equal(strict.summary.pending, 1)
  })

  const build = await run('build')
  check('build regenerates the token CSS', () => {
    assert.equal(build.ok, true)
    assert.match(build.lines.map((line) => line.text).join('\n'), /410 tokens/)
  })

  const registry = await run('registry')
  check('registry renders the markdown', () => {
    assert.equal(registry.ok, true)
    assert.match(registry.lines.map((line) => line.text).join('\n'), /5 components/)
  })

  const paths = await run('paths')
  check('paths points at this repository', () => {
    assert.equal(paths.ok, true)
    assert.match(paths.lines.map((line) => line.text).join('\n'), new RegExp(`plugin:.*${VERSION.replace(/\./g, '\\.')}`))
  })

  const unknown = await run('deploy')
  check('an unknown command is refused', () => assert.equal(unknown.ok, false))
})()

const failed = results.filter((entry) => entry.status === 'failed')
for (const entry of results) console.log(`${entry.status === 'ok' ? '✓' : '✗'} ${entry.name}${entry.error ? `\n    ${entry.error}` : ''}`)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
