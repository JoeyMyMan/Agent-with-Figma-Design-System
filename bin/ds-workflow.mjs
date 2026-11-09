#!/usr/bin/env node
// ds-workflow — Figma design system ↔ code, for any coding agent. `ds-workflow help` lists the commands.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProject } from '../lib/build.mjs';
import { check, updateBaseline } from '../lib/check.mjs';
import { CONFIG_FILE, loadConfig, paths } from '../lib/config.mjs';
import { init } from '../lib/init.mjs';
import { renderProject } from '../lib/registry.mjs';
import { checkLedger, reviewSummary } from '../lib/review.mjs';
import { PKG, VERSION, writeRules } from '../lib/rules.mjs';
import { fromHtml } from '../lib/html.mjs';
import { describeSource, nextSteps, resolveSource } from '../lib/source.mjs';
import { fromRest, mergeExports, originOf, pin, readExports } from '../lib/sync.mjs';
import { sha256, writeJson } from '../lib/util.mjs';
import { globToRegExp } from '../lib/util.mjs';

const HELP = `ds-workflow ${VERSION}

  init [--name <ds name>] [--source <Figma link | file.html> [source options]] [--prefix <css prefix>]
       [--proposal-prefix <Proposed>] [--agents <list>] [--skills-dir <dir,…>] [--review-channel figma|issue|both] [--force]
        config, design-system/ skeleton, review ledger, CI, agent rules, playbooks copy (never overwrites without --force)
        --agents: agents-md (always), claude, gemini, cursor, copilot, cline; default auto = the agents found in the repo
  source [<Figma link | file.html>] [--library] [--from-community <link>] [--license <text>]
         [--components <Figma link>] [--work-file <Figma link>]
        where the design system comes from: a Figma file or a link into it, your team's library (--library), a
        Figma Community kit (its Community link, then your duplicate with --from-community), or the designer's HTML
        export (--components: the Figma file with its components). No argument: show it and the next steps
  sync  [--label <version>]                      pin from the configured source (HTML: the file; Figma: the exports)
  sync  --export <file…> [--label <version>]     pin from the Figma plugin export (figma/export-design-system.js via use_figma)
  sync  --html <file> [--export <file…>]         pin from an HTML export (+ a components export)
  sync  --figma [--label <version>]              pin from the Figma REST API (FIGMA_TOKEN; variables need Enterprise)
  build                                          tokens → CSS custom properties + design-system/tokens/names.json
  check [--update]                               the gate; --update lowers the literal baseline after a migration
  registry                                       design-system/components.registry.json → readable markdown
  review [--strict]                              the review ledger: Ready / unconfirmed / waiting; --strict fails while
                                                 anything waits for the designer (use it before a production release)
  rules [--skills-dir <dir,…>]                   refresh the agent rules and the playbooks copy
  paths                                          where the package's playbooks and Figma export script are
`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const root = process.cwd();
/** --skills-dir a,b (and the 0.1 flag --claude-skills = .claude/skills) */
const skillsDirs = () => [...(opt('skills-dir')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []), ...(flag('claude-skills') ? ['.claude/skills'] : [])];

const sourceOpts = () => ({ library: flag('library'), fromCommunity: opt('from-community'), license: opt('license'), components: opt('components'), workFile: opt('work-file') });

/** expand 'dir/*.json' (the shell usually does; not when quoted) */
function expand(a) {
  if (!a.includes('*')) return [a];
  const dir = a.slice(0, a.lastIndexOf('/')) || '.';
  if (!existsSync(join(root, dir))) return [];
  const re = globToRegExp(a.slice(a.lastIndexOf('/') + 1));
  return readdirSync(join(root, dir)).filter((f) => re.test(f)).map((f) => join(dir, f));
}

/** --export a.json b.json 'dir/*.json' (the shell usually expands the glob; expand it here when it did not) */
function exportFiles() {
  const i = argv.indexOf('--export');
  const out = [];
  for (const a of argv.slice(i + 1)) {
    if (a.startsWith('--')) break;
    out.push(...expand(a));
  }
  return out;
}

function needConfig(cfg) {
  if (!cfg.found) {
    console.error(`${CONFIG_FILE} not found — run \`npx ds-workflow init\` first`);
    process.exit(1);
  }
}

try {
  if (!cmd || cmd === 'help' || flag('help')) {
    console.log(HELP);
  } else if (cmd === 'init') {
    const r = init(root, { name: opt('name'), fileKey: opt('file-key'), source: opt('source'), sourceOpts: sourceOpts(), prefix: opt('prefix'), proposalPrefix: opt('proposal-prefix'), agents: opt('agents'), skillsDirs: skillsDirs(), reviewChannel: opt('review-channel'), force: flag('force') });
    console.log(`created / updated:\n  ${r.created.join('\n  ')}`);
    if (r.skipped.length) console.log(`kept (already there):\n  ${r.skipped.join('\n  ')}`);
    const src = loadConfig(root).designSystem.source;
    console.log(`\nsource: ${describeSource(src)}\nnext:\n  ${nextSteps(src).join('\n  ')}\nthen build → check (docs/ds-workflow/ds-adopt/SKILL.md)`);
  } else if (cmd === 'source') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    const input = argv[1] && !argv[1].startsWith('--') ? argv[1] : null;
    let src = cfg.designSystem.source;
    if (input) {
      src = resolveSource(input, { ...sourceOpts(), root });
      const file = join(root, CONFIG_FILE);
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      raw.designSystem = { ...raw.designSystem, source: src };
      delete raw.designSystem.figmaFileKey;
      writeJson(file, raw);
      // the agents' rules name the source: refresh them with it
      writeRules(loadConfig(root));
      console.log(`${CONFIG_FILE}: designSystem.source updated; agent rules refreshed`);
    }
    console.log(`source: ${describeSource(src)}\nnext:\n  ${nextSteps(src).join('\n  ')}`);
  } else if (cmd === 'sync') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    let exp;
    let source;
    let origin;
    const src = cfg.designSystem.source;
    const htmlFile = opt('html') ?? (!flag('figma') && src?.kind === 'html' ? src.html : null);
    const files = flag('export') ? exportFiles() : !flag('figma') && !htmlFile ? expand(`${paths.sourceDir}/figma-export.*.json`) : [];
    if (flag('export') && !files.length) throw new Error('--export needs at least one file');
    if (htmlFile) {
      const buf = readFileSync(join(root, htmlFile));
      const fromPage = fromHtml(buf.toString('utf8'));
      // components from Figma may join an HTML export; tokens come from one place only
      const parts = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
      if (parts.some((p) => p.variables?.length || p.paintStyles?.length || p.textStyles?.length || p.effectStyles?.length))
        throw new Error('tokens come from the HTML export: pass only components exports with --html (PART = components)');
      exp = parts.length ? { ...mergeExports([...parts, { ...fromPage, components: fromPage.components ?? [] }]), source: 'html' } : fromPage;
      if (!exp.fileName) exp.fileName = cfg.designSystem.name;
      source = `html${parts.length ? ` + plugin-export (${parts.length} components file${parts.length > 1 ? 's' : ''})` : ''}`;
      origin = originOf(src?.kind === 'html' ? src : { kind: 'html', html: htmlFile }, { htmlSha256: sha256(buf) });
    } else if (files.length) {
      exp = readExports(files);
      source = `plugin-export (${files.length} file${files.length > 1 ? 's' : ''})`;
    } else if (flag('figma')) {
      if (!process.env.FIGMA_TOKEN) throw new Error('FIGMA_TOKEN is not set');
      if (!cfg.designSystem.figmaFileKey) throw new Error(`no Figma file to read: ${describeSource(cfg.designSystem.source)}`);
      exp = await fromRest(cfg.designSystem.figmaFileKey, process.env.FIGMA_TOKEN);
      source = 'rest';
    } else throw new Error(`nothing to sync from. Source: ${describeSource(src)}\n  ${nextSteps(src).join('\n  ')}`);
    const r = pin(cfg, exp, { label: opt('label'), source, origin });
    console.log(`${r.lock.label}: ${JSON.stringify(r.lock.counts)} pinned${r.report ? `; upgrade report → ${r.report}` : ''}`);
    if (r.lock.warning) console.warn(`warning: ${r.lock.warning}`);
    console.log('next: npx ds-workflow build && npx ds-workflow check');
  } else if (cmd === 'build') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    const r = buildProject(cfg);
    console.log(`${r.css}: ${r.count} tokens`, r.by);
  } else if (cmd === 'check') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    const r = check(cfg);
    if (flag('update')) {
      updateBaseline(cfg, r.counts);
      console.log(`baseline updated (${Object.keys(r.counts).length} files with literals)`);
    }
    const literals = Object.values(r.counts).reduce((n, c) => n + c.colors + (c.legacyLiterals ?? 0), 0);
    const hard = flag('update') ? r.errors.filter((e) => !/\(baseline \d+\)/.test(e)) : r.errors;
    for (const e of hard) console.error(`✗ ${e}`);
    console.log(`${r.files} files checked · ${literals} literal(s) still to migrate · ${hard.length} error(s)`);
    process.exit(hard.length ? 1 : 0);
  } else if (cmd === 'registry') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    const r = renderProject(cfg);
    console.log(`${r.file}: ${r.count} components`);
  } else if (cmd === 'rules') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    console.log(`updated:\n  ${writeRules(cfg, { skillsDirs: skillsDirs() }).join('\n  ')}`);
  } else if (cmd === 'review') {
    const cfg = loadConfig(root);
    needConfig(cfg);
    const errors = checkLedger(cfg);
    const s = reviewSummary(cfg);
    console.log(s.text);
    for (const e of errors) console.error(`✗ ${e}`);
    if (flag('strict') && s.pending) console.error(`✗ ${s.pending} change(s) still waiting for the designer's review`);
    process.exit(errors.length || (flag('strict') && s.pending) ? 1 : 0);
  } else if (cmd === 'paths') {
    console.log(`package:   ${PKG}\nplaybooks: ${join(PKG, 'playbooks')}\nexport:    ${join(PKG, 'figma/export-design-system.js')}`);
  } else {
    console.error(`unknown command ${cmd}\n\n${HELP}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`ds-workflow ${cmd}: ${e.message}`);
  process.exit(1);
}
