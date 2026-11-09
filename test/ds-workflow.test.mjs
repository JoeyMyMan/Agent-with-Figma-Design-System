import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build } from '../lib/build.mjs';
import { check } from '../lib/check.mjs';
import { loadConfig, paths } from '../lib/config.mjs';
import { diffTokens } from '../lib/diff.mjs';
import { init } from '../lib/init.mjs';
import { fromHtml, parseColor } from '../lib/html.mjs';
import { render } from '../lib/registry.mjs';
import { parseFigmaUrl, resolveSource } from '../lib/source.mjs';
import { upsertBlock } from '../lib/rules.mjs';
import { EXPORT_FORMAT, fromRest, mergeExports, pin, toDesignSystem, weightOf } from '../lib/sync.mjs';
import { writeJson, writeText } from '../lib/util.mjs';

const CLI = join(import.meta.dirname, '../bin/ds-workflow.mjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'dsw-'));

const EXPORT = {
  format: EXPORT_FORMAT,
  fileKey: 'FILEKEY123',
  fileName: 'Kit',
  exportedAt: '2026-11-04T00:00:00Z',
  collections: [{ id: 'C1', name: 'Primitive', defaultModeId: 'm1', modes: [{ modeId: 'm1', name: 'Light' }, { modeId: 'm2', name: 'Dark' }] }],
  variables: [
    { id: 'V1', name: 'color/brand/6', collectionId: 'C1', type: 'COLOR', scopes: ['ALL_FILLS'], valuesByMode: { m1: { r: 0.2, g: 0.4, b: 1, a: 1 }, m2: { r: 0, g: 0, b: 0, a: 1 } } },
    { id: 'V2', name: 'color/action/primary', collectionId: 'C1', type: 'COLOR', scopes: [], valuesByMode: { m1: { type: 'VARIABLE_ALIAS', id: 'V1' }, m2: { type: 'VARIABLE_ALIAS', id: 'V1' } } },
    { id: 'V3', name: 'radius/m', collectionId: 'C1', type: 'FLOAT', scopes: ['CORNER_RADIUS'], valuesByMode: { m1: 20, m2: 20 } },
    { id: 'V4', name: 'opacity/disabled', collectionId: 'C1', type: 'FLOAT', scopes: ['OPACITY'], valuesByMode: { m1: 0.2, m2: 0.2 } },
    { id: 'V5', name: 'font/primary-font-family', collectionId: 'C1', type: 'STRING', scopes: ['FONT_FAMILY'], valuesByMode: { m1: 'Open Sans', m2: 'Open Sans' } },
  ],
  paintStyles: [{ id: 'S:1', key: 'k1', name: 'Gray/900(text)', paints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.88 }] }],
  textStyles: [{ id: 'S:2', key: 'k2', name: 'Body/L/bold', fontFamily: 'Open Sans', fontStyle: 'Bold', fontSize: 18, lineHeight: { unit: 'PIXELS', value: 28 }, letterSpacing: { unit: 'PERCENT', value: 0 } }],
  effectStyles: [{ id: 'S:3', key: 'k3', name: 'card', effects: [{ type: 'DROP_SHADOW', visible: true, radius: 8, spread: 0, offset: { x: 0, y: 2 }, color: { r: 0, g: 0, b: 0, a: 0.1 } }] }],
  components: [
    { name: 'button-play', kind: 'COMPONENT_SET', nodeId: '100:200', key: 'ck1', page: 'Components', properties: { State: { type: 'VARIANT', values: ['Default', 'Hover'] } } },
    { name: 'icon-x', kind: 'COMPONENT', nodeId: '10:2', key: 'ck2', page: 'Icons' },
  ],
};

const cfgFor = (root, over = {}) => ({ ...loadConfig(root), ...over });

function project({ withExport = true } = {}) {
  const root = tmp();
  init(root, { name: 'Kit', fileKey: 'FILEKEY123', prefix: 'acme', proposalPrefix: 'Acme' });
  const cfg = loadConfig(root);
  if (withExport) {
    pin(cfg, EXPORT, { label: 'DS-1', source: 'test' });
    execFileSync('node', [CLI, 'build'], { cwd: root });
  }
  return { root, cfg: loadConfig(root) };
}

test('weights from Figma font styles', () => {
  assert.equal(weightOf('Bold'), 700);
  assert.equal(weightOf('Semi Bold'), 600);
  assert.equal(weightOf('Black Italic'), 900);
  assert.equal(weightOf('Regular'), 400);
});

test('export → DTCG: colours, aliases, modes, units, styles', () => {
  const { tokens, components } = toDesignSystem(EXPORT);
  assert.equal(tokens.variables.color.brand['6'].$value, 'rgba(51, 102, 255, 1)');
  assert.equal(tokens.variables.color.action.primary.$extensions.figma.alias, 'color/brand/6');
  assert.equal(tokens.variables.color.brand['6'].$extensions.figma.modes.Dark.value, 'rgba(0, 0, 0, 1)');
  assert.equal(tokens.variables.radius.m.$value, '20px');
  assert.equal(tokens.variables.opacity.disabled.$value, 0.2);
  assert.equal(tokens.paint['Gray']['900(text)'].$value, 'rgba(0, 0, 0, 0.88)');
  assert.deepEqual(tokens.text.Body.L.bold.$value, { fontFamily: 'Open Sans', fontWeight: 700, fontSize: '18px', lineHeight: '28px', letterSpacing: '0px' });
  assert.equal(tokens.effect.card.$value, 'box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.1);');
  assert.equal(components.length, 2);
});

test('alias with opacity (Figma { color: alias, opacity }) resolves to a colour', () => {
  const exp = structuredClone(EXPORT);
  exp.variables.push(
    { id: 'W100', name: 'color/white/100', collectionId: 'C1', type: 'COLOR', valuesByMode: { m1: { r: 1, g: 1, b: 1, a: 1 }, m2: { r: 1, g: 1, b: 1, a: 1 } } },
    // as the plugin export writes it (flattened) and as the raw API shape
    { id: 'W10', name: 'color/white/10', collectionId: 'C1', type: 'COLOR', valuesByMode: { m1: { type: 'VARIABLE_ALIAS', id: 'W100', opacity: 0.1 }, m2: { type: 'VARIABLE_ALIAS', id: 'W100', opacity: 0.1 } } },
    { id: 'W20', name: 'color/white/20', collectionId: 'C1', type: 'COLOR', valuesByMode: { m1: { color: { type: 'VARIABLE_ALIAS', id: 'W100' }, opacity: 20 }, m2: { color: { type: 'VARIABLE_ALIAS', id: 'W100' }, opacity: 20 } } },
  );
  const { tokens } = toDesignSystem(exp);
  assert.equal(tokens.variables.color.white['10'].$value, 'rgba(255, 255, 255, 0.1)');
  assert.equal(tokens.variables.color.white['10'].$extensions.figma.aliasOf, 'color/white/100');
  assert.equal(tokens.variables.color.white['20'].$value, 'rgba(255, 255, 255, 0.2)');
  const { css } = build(cfgFor(tmp(), { tokens: { prefix: 'x', css: 'a.css', proposed: 'p.json' } }), [{ tree: tokens, status: 'pinned' }]);
  assert.match(css, /--x-color-white-10: rgba\(255, 255, 255, 0.1\);/);
});

test('build: names, aliases as var(), modes, proposals', () => {
  const root = tmp();
  const cfg = cfgFor(root, { tokens: { prefix: 'acme', css: 'x.css', proposed: 'p.json' } });
  const { tokens } = toDesignSystem(EXPORT);
  const proposed = { variables: { color: { text: { primary: { $type: 'color', $value: 'rgba(0,0,0,.88)', $extensions: { proposal: { status: 'proposed', alias: 'paint/Gray/900(text)' } } } } } } };
  const { css, names } = build(cfg, [{ tree: tokens, status: 'pinned' }, { tree: proposed, status: 'proposed' }]);
  assert.match(css, /--acme-color-brand-6: rgba\(51, 102, 255, 1\);/);
  assert.match(css, /--acme-color-action-primary: var\(--acme-color-brand-6\);/);
  assert.match(css, /--acme-paint-gray-900-text: rgba\(0, 0, 0, 0.88\);/);
  assert.match(css, /--acme-text-body-l-bold: 700 18px\/28px "Open Sans";/);
  assert.match(css, /--acme-effect-card: 0px 2px 8px 0px rgba\(0, 0, 0, 0.1\);/);
  assert.match(css, /--acme-font-primary-font-family: "Open Sans";/);
  assert.match(css, /\[data-primitive="dark"\] \{\n {2}--acme-color-brand-6: rgba\(0, 0, 0, 1\);/);
  assert.match(css, /--acme-color-text-primary: var\(--acme-paint-gray-900-text\); \/\* proposed → paint\/Gray\/900\(text\) \*\//);
  assert.equal(names['--acme-color-text-primary'].status, 'proposed');
});

test('check: unknown tokens, literals, px in components, font-family, ratchet, registry', () => {
  const { root, cfg } = project();
  writeText(join(root, 'src/ui/Button/Button.css'), '.b { color: var(--acme-color-brand-6); padding: 12px; margin: var(--legacy-gap); }\n@media (max-width: 600px) { .b { color: var(--acme-nope); } }');
  writeText(join(root, 'src/pages/Home.css'), '.h { color: #fff; font-family: Arial; }\n@font-face { font-family: X; }');
  writeText(join(root, 'src/pages/Ok.tsx'), 'export const A = () => <div style={{ color: "var(--acme-color-brand-6)" }} />; // #000 in a comment');
  let r = check(cfg);
  const msg = r.errors.join('\n');
  assert.match(msg, /Button\.css: --acme-nope is not a token of DS-1/);
  assert.match(msg, /Button\.css: 12px — use a --acme-\* size/);
  assert.match(msg, /Button\.css: --legacy-gap — components use --acme-\* tokens only/);
  assert.match(msg, /Home\.css: font-family "Arial"/);
  assert.match(msg, /Home\.css: 1 hard-coded colour\(s\) \(baseline 0\)/);
  assert.doesNotMatch(msg, /Ok\.tsx/);
  assert.doesNotMatch(msg, /font-family "X"/);

  // registry rules
  writeJson(join(root, paths.registry), {
    components: [
      { code: 'ui/PlayButton', status: 'reuse', figma: { nodeId: '100:200' } },
      { code: 'ui/Ghost', status: 'extend', figma: { nodeId: '1:1' } },
      { code: 'ui/Card', status: 'proposed' },
      { code: 'ui/Arrow', status: 'reuse', figmaPending: { nodeId: '300:400' } },
      { code: 'ui/PlayButton', status: 'wat' },
    ],
  });
  r = check(cfg);
  const reg = r.errors.filter((e) => e.startsWith('registry')).join('\n');
  assert.match(reg, /ui\/Ghost: extend needs figma\.nodeId/);
  assert.match(reg, /ui\/Card: proposed components are named acme\//);
  assert.match(reg, /ui\/PlayButton: unknown status wat/);
  assert.match(reg, /ui\/PlayButton: listed twice/);
  assert.doesNotMatch(reg, /ui\/Arrow/);
});

test('check --update accepts current literals; new ones fail again', () => {
  const { root } = project();
  writeText(join(root, 'src/pages/Home.css'), '.h { color: #fff; }');
  assert.throws(() => execFileSync('node', [CLI, 'check'], { cwd: root, stdio: 'pipe' }));
  execFileSync('node', [CLI, 'check', '--update'], { cwd: root, stdio: 'pipe' });
  execFileSync('node', [CLI, 'check'], { cwd: root, stdio: 'pipe' });
  writeText(join(root, 'src/pages/Home.css'), '.h { color: #fff; background: rgb(1,2,3); }');
  assert.throws(() => execFileSync('node', [CLI, 'check'], { cwd: root, stdio: 'pipe' }));
});

test('sync twice → upgrade report with removed / renamed / changed tokens and components', () => {
  const { root, cfg } = project();
  const next = structuredClone(EXPORT);
  next.variables[2].valuesByMode = { m1: 24, m2: 24 }; // radius/m changed
  next.variables[3].name = 'opacity/muted'; // renamed (same value)
  next.components[0].properties = { State: { type: 'VARIANT', values: ['Default', 'Hover', 'Disabled'] } };
  next.components.pop(); // icon-x removed
  const r = pin(cfg, next, { label: 'DS-2', source: 'test' });
  assert.equal(r.report, `${paths.migrations}/DS-1→DS-2.md`);
  const md = readFileSync(join(root, r.report), 'utf8');
  assert.match(md, /`variables\/radius\/m`: "20px" → "24px"/);
  assert.match(md, /`variables\/opacity\/disabled` → `variables\/opacity\/muted`/);
  assert.match(md, /icon-x \(10:2\)/);
  assert.match(md, /button-play \(100:200\): /);
  assert.equal(JSON.parse(readFileSync(join(root, paths.lock), 'utf8')).previous.label, 'DS-1');
});

test('diffTokens finds renames by equal value', () => {
  const a = { variables: { x: { $type: 'number', $value: 1 } } };
  const b = { variables: { y: { $type: 'number', $value: 1 } } };
  assert.deepEqual(diffTokens(a, b).renamed, [{ from: 'variables/x', to: 'variables/y' }]);
});

test('merge exports: tokens part + components parts; rejects two files', () => {
  const t = { ...EXPORT, components: [] };
  const c = { format: EXPORT_FORMAT, fileKey: 'FILEKEY123', components: EXPORT.components };
  assert.equal(mergeExports([t, c]).components.length, 2);
  assert.throws(() => mergeExports([t, { ...c, fileKey: 'OTHER' }]), /two files/);
  assert.throws(() => mergeExports([{ format: 'x' }]), /not a ds-workflow/);
});

test('REST API → the same normalised shape', async () => {
  const routes = {
    'files/K?depth=1': { name: 'Kit' },
    'files/K/versions': { versions: [{ id: '123', label: 'DS 1.0.0', created_at: '2026-11-03T10:00:00Z' }] },
    'files/K/variables/local': { meta: { variableCollections: { C1: EXPORT.collections[0] }, variables: Object.fromEntries(EXPORT.variables.map((v) => [v.id, { ...v, variableCollectionId: v.collectionId, resolvedType: v.type }])) } },
    'files/K/styles': { meta: { styles: [{ key: 'k1', node_id: '1:1', style_type: 'FILL', name: 'Gray/900(text)' }, { key: 'k2', node_id: '1:2', style_type: 'TEXT', name: 'Body/L/bold' }, { key: 'k3', node_id: '1:3', style_type: 'EFFECT', name: 'card' }] } },
    [`files/K/nodes?ids=${encodeURIComponent('1:1,1:2,1:3')}`]: {
      nodes: {
        '1:1': { document: { fills: EXPORT.paintStyles[0].paints } },
        '1:2': { document: { style: { fontFamily: 'Open Sans', fontPostScriptName: 'OpenSans-Bold', fontWeight: 700, fontSize: 18, lineHeightPx: 28, letterSpacing: 0 } } },
        '1:3': { document: { effects: EXPORT.effectStyles[0].effects } },
      },
    },
    'files/K/component_sets': { meta: { component_sets: [{ name: 'button-play', node_id: '100:200', key: 'ck1', containing_frame: { pageName: 'Components' } }] } },
    'files/K/components': { meta: { components: [{ name: 'State=Default', node_id: '100:201', containing_frame: { containingComponentSet: { nodeId: '100:200' } } }, { name: 'icon-x', node_id: '10:2', key: 'ck2', containing_frame: { pageName: 'Icons' } }] } },
  };
  const fakeFetch = async (url) => {
    const path = url.replace('https://api.figma.com/v1/', '');
    if (!(path in routes)) return { ok: false, status: 404, text: async () => path };
    return { ok: true, json: async () => routes[path] };
  };
  const exp = await fromRest('K', 'token', fakeFetch);
  assert.equal(exp.version.label, 'DS 1.0.0');
  const { tokens, components } = toDesignSystem(exp);
  assert.equal(tokens.variables.color.action.primary.$extensions.figma.alias, 'color/brand/6');
  assert.equal(tokens.text.Body.L.bold.$value.fontWeight, 700);
  assert.equal(tokens.effect.card.$value, 'box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.1);');
  assert.deepEqual(components.map((c) => c.name), ['icon-x', 'button-play']);
});

test('init never overwrites; rules keeps the rest of AGENTS.md and updates its block', () => {
  const root = tmp();
  writeText(join(root, 'AGENTS.md'), '# Project\n\nOur own rules.\n');
  writeText(join(root, 'CLAUDE.md'), '# Claude\n');
  writeJson(join(root, 'package.json'), { name: 'x', scripts: { test: 'vitest' } });
  const a = init(root, { name: 'Kit', fileKey: 'FILEKEY123', prefix: 'acme' });
  assert.ok(a.created.includes('design-system.config.json'));
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Our own rules\./);
  assert.match(agents, /var\(--acme-\*\)/);
  assert.match(agents, /docs\/ds-workflow\/ds-align-ready-for-dev\/SKILL\.md/);
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md$/m);
  assert.ok(existsSync(join(root, 'docs/ds-workflow/figma/export-design-system.js')));
  assert.ok(!existsSync(join(root, '.cursor/rules/ds-workflow.mdc'))); // auto: only agents found in the repo
  assert.ok(existsSync(join(root, 'design-system/figma-review.json')));
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['ds:check'], 'ds-workflow check');
  // second run: nothing overwritten, block replaced not duplicated
  writeText(join(root, paths.registry), '{"components":[{"code":"ui/X","status":"reuse"}]}');
  const b = init(root, {});
  assert.ok(b.skipped.includes(paths.registry));
  assert.match(readFileSync(join(root, paths.registry), 'utf8'), /ui\/X/);
  const again = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(again.match(/ds-workflow:start/g).length, 1);
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8').match(/@AGENTS\.md/g).length, 1);
});

test('upsertBlock appends once and replaces in place', () => {
  const one = upsertBlock('# A\n', 'X');
  const two = upsertBlock(one + '\nafter\n', 'Y');
  assert.match(two, /Y/);
  assert.doesNotMatch(two, /\nX\n/);
  assert.match(two, /after/);
});

test('registry markdown groups by status', () => {
  const md = render(loadConfig(tmp()), { designSystem: 'DS-1', components: [{ code: 'ui/A', status: 'reuse', description: 'a', figma: { nodeId: '1:1', name: 'A', url: 'u' } }, { code: 'proposed/Cart/Card', status: 'proposed', description: 'c' }] });
  assert.match(md, /## Reused \(1\)/);
  assert.match(md, /`Proposed\/Cart\/Card` \(new\)/);
});

test('cli: init → sync --export → build → check passes on a clean project', () => {
  const root = tmp();
  execFileSync('node', [CLI, 'init', '--name', 'Kit', '--file-key', 'FILEKEY123', '--prefix', 'acme'], { cwd: root });
  writeFileSync(join(root, 'exp.json'), JSON.stringify(EXPORT));
  const out = execFileSync('node', [CLI, 'sync', '--export', 'exp.json', '--label', 'DS-1'], { cwd: root }).toString();
  assert.match(out, /DS-1: .*"components":2/);
  execFileSync('node', [CLI, 'build'], { cwd: root });
  assert.match(readFileSync(join(root, 'src/styles/acme-tokens.css'), 'utf8'), /--acme-color-brand-6/);
  writeText(join(root, 'src/ui/A/A.css'), '.a { color: var(--acme-color-action-primary); border-radius: var(--acme-radius-m); }');
  execFileSync('node', [CLI, 'check'], { cwd: root });
  execFileSync('node', [CLI, 'registry'], { cwd: root });
  assert.ok(existsSync(join(root, 'docs/design/component-registry.md')));
});

test('agent targets: auto detects the agents in the repo; explicit lists, extra files and skill folders', () => {
  const root = tmp();
  mkdirSync(join(root, '.cursor'), { recursive: true });
  writeText(join(root, '.github/copilot-instructions.md'), '# ours\n');
  writeText(join(root, '.clinerules'), 'our cline rules\n');
  init(root, { name: 'Kit', prefix: 'acme' });
  assert.ok(existsSync(join(root, '.cursor/rules/ds-workflow.mdc')));
  const copilot = readFileSync(join(root, '.github/instructions/ds-workflow.instructions.md'), 'utf8');
  assert.match(copilot, /^---\napplyTo: "src\/\*\*\/\*\.css,/);
  assert.match(copilot, /var\(--acme-\*\)/);
  assert.equal(readFileSync(join(root, '.github/copilot-instructions.md'), 'utf8'), '# ours\n');
  assert.match(readFileSync(join(root, '.clinerules'), 'utf8'), /^our cline rules\n[\s\S]*ds-workflow:start/);
  assert.ok(!existsSync(join(root, 'GEMINI.md')));

  const other = tmp();
  init(other, { agents: 'gemini,claude', skillsDirs: ['.agents/skills'] });
  assert.match(readFileSync(join(other, 'GEMINI.md'), 'utf8'), /^@AGENTS\.md$/m);
  assert.match(readFileSync(join(other, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md$/m);
  assert.ok(existsSync(join(other, '.agents/skills/ds-review-loop/SKILL.md')));
  const cfg = loadConfig(other);
  assert.deepEqual(cfg.agents.targets, ['gemini', 'claude']);
  writeJson(join(other, 'design-system.config.json'), { ...JSON.parse(readFileSync(join(other, 'design-system.config.json'), 'utf8')), agents: { targets: ['nope'] } });
  assert.throws(() => execFileSync('node', [CLI, 'rules'], { cwd: other, stdio: 'pipe' }));
  writeJson(join(other, 'design-system.config.json'), { ...JSON.parse(readFileSync(join(other, 'design-system.config.json'), 'utf8')), agents: { targets: 'auto', extraFiles: ['docs/AGENT_RULES.md'] } });
  execFileSync('node', [CLI, 'rules'], { cwd: other, stdio: 'pipe' });
  assert.match(readFileSync(join(other, 'docs/AGENT_RULES.md'), 'utf8'), /ds-workflow:start[\s\S]*ds-review-loop/);
});

test('review ledger: Ready / unconfirmed nodes are never changed in place; review --strict', () => {
  const { root, cfg } = project();
  const ledger = join(root, 'design-system/figma-review.json');
  execFileSync('node', [CLI, 'review', '--strict'], { cwd: root, stdio: 'pipe' }); // empty ledger
  writeJson(ledger, {
    file: 'FILEKEY123',
    ready: [{ section: 'Checkout › Summary', nodeId: '50:1', frames: [{ name: '1.01', nodeId: '50:2' }, '1.02'], since: '2025-01-10' }],
    unconfirmed: [{ section: 'Checkout › Payment', nodeId: '60:1' }],
    pending: [{ added: '2025-01-12', what: 'Summary card v2', code: ['#7'], nodes: { screens: ['50:9'], components: ['70:1'] } }],
    reviewQueue: { page: 'Screens · DS-1', nodeId: '80:1' },
  });
  assert.deepEqual(check(cfg).errors, []);
  const out = execFileSync('node', [CLI, 'review'], { cwd: root }).toString();
  assert.match(out, /ready for dev \(1\): Checkout › Summary \(code not aligned yet\)/);
  assert.match(out, /Summary card v2 {2}\[#7\]/);
  assert.throws(() => execFileSync('node', [CLI, 'review', '--strict'], { cwd: root, stdio: 'pipe' }));

  writeJson(ledger, {
    ready: [{ section: 'A', nodeId: '50:1', frames: [{ name: '1.01', nodeId: '50:2' }] }],
    unconfirmed: [{ section: 'B', nodeId: '50:1' }],
    pending: [{ added: '2025-01-12', nodes: { screens: ['50-2', 'x'] } }, { added: 'soon', nodes: {} }],
  });
  const msg = check(cfg).errors.join('\n');
  assert.match(msg, /ready "A" needs since/);
  assert.match(msg, /50:1 is listed twice/);
  assert.match(msg, /pending\[0\] changes 50-2, which is ready "A": put the change in a v2 beside it/);
  assert.match(msg, /"x" is not a node id/);
  assert.match(msg, /pending\[1\] needs added/);
  assert.match(msg, /pending\[1\] lists no nodes/);
});

test('source: the four kinds of design system link', () => {
  // 1. a link into a design file (node-id, tracking parameters dropped; branch links read the branch)
  const f = resolveSource('https://www.figma.com/design/AbCdEf123456/Acme-Kit?node-id=12-345&t=xyz-0');
  assert.deepEqual(f, { kind: 'figma-file', fileKey: 'AbCdEf123456', fileName: 'Acme-Kit', nodeId: '12:345', url: 'https://www.figma.com/design/AbCdEf123456/Acme-Kit?node-id=12-345' });
  assert.equal(parseFigmaUrl('https://www.figma.com/design/AbCdEf123456/branch/BrAnCh987654/Acme-Kit').fileKey, 'BrAnCh987654');
  assert.equal(parseFigmaUrl('https://figma.com/file/AbCdEf123456/Old-Link').fileKey, 'AbCdEf123456');
  // 2. a Community kit: not readable until duplicated; then the copy is the file, the Community link the origin
  const c = resolveSource('https://www.figma.com/community/file/1035203688168086460/some-ui-kit');
  assert.equal(c.kind, 'figma-community');
  assert.equal(c.fileKey, '');
  const dup = resolveSource('https://www.figma.com/design/CoPy12345678/some-ui-kit-copy', { fromCommunity: c.communityUrl, license: 'CC BY 4.0' });
  assert.deepEqual([dup.kind, dup.fileKey, dup.communityUrl, dup.license], ['figma-community', 'CoPy12345678', 'https://www.figma.com/community/file/1035203688168086460/some-ui-kit', 'CC BY 4.0']);
  // 3. the team's published library, with a separate work file for proposals and screens
  const lib = resolveSource('https://www.figma.com/design/LiBrArY12345/Team-Library', { library: true, workFile: 'https://www.figma.com/design/WoRk12345678/Project' });
  assert.deepEqual([lib.kind, lib.workFile.fileKey], ['figma-library', 'WoRk12345678']);
  // 4. the designer's HTML export: copied into the repo when it is outside
  const root = tmp();
  const outside = join(tmp(), 'spec.html');
  writeFileSync(outside, '<style>:root{--c:#fff}</style>');
  const h = resolveSource(outside, { root, components: 'https://www.figma.com/design/CoMp12345678/Components' });
  assert.equal(h.kind, 'html');
  assert.equal(h.html, 'design-system/source/spec.html');
  assert.ok(existsSync(join(root, h.html)));
  assert.equal(h.components.fileKey, 'CoMp12345678');
  // not design files
  assert.throws(() => resolveSource('https://www.figma.com/board/AbCdEf123456/Map'), /FigJam/);
  assert.throws(() => resolveSource('https://www.figma.com/community/plugin/123/x'), /must point at a file/);
  assert.throws(() => resolveSource('https://example.com/design/AbCdEf123456'), /not a Figma link/);
  assert.throws(() => resolveSource('tokens.json'), /Figma link or an \.html file/);
});

test('html export → tokens: CSS custom properties, DTCG, Figma-like data', () => {
  assert.deepEqual(parseColor('#36f'), { r: 0.2, g: 0.4, b: 1, a: 1 });
  assert.equal(parseColor('rgb(0 0 0 / 50%)').a, 0.5);
  assert.equal(parseColor('red'), null);

  const css = fromHtml('<html><style>/* x */ :root { --color-brand: #3366ff; --color-link: var(--color-brand); --space-4: 16px; --opacity-muted: 0.5; --font-body: "Open Sans", sans-serif; }</style></html>');
  const { tokens: t1 } = toDesignSystem(css);
  assert.equal(t1.variables['color-brand'].$value, 'rgba(51, 102, 255, 1)');
  assert.equal(t1.variables['color-link'].$value, '{color-brand}');
  assert.equal(t1.variables['space-4'].$value, '16px');
  assert.equal(t1.variables['opacity-muted'].$value, 0.5);
  assert.equal(t1.variables['font-body'].$value, '"Open Sans", sans-serif');

  const dtcg = {
    color: { brand: { $type: 'color', $value: '#3366ff' }, action: { $type: 'color', $value: '{color.brand}' } },
    radius: { m: { $type: 'dimension', $value: '12px' } },
    type: { body: { $type: 'typography', $value: { fontFamily: 'Open Sans', fontWeight: 400, fontSize: '16px', lineHeight: 1.5, letterSpacing: '0px' } } },
    shadow: { card: { $type: 'shadow', $value: { color: '#00000020', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' } } },
  };
  const { tokens: t2 } = toDesignSystem(fromHtml(`<script type="application/json" id="tokens">${JSON.stringify(dtcg)}</script>`));
  assert.equal(t2.variables.color.action.$value, '{color.brand}');
  assert.equal(t2.variables.radius.m.$value, '12px');
  assert.deepEqual(t2.text.type.body.$value, { fontFamily: 'Open Sans', fontWeight: 400, fontSize: '16px', lineHeight: '24px', letterSpacing: '0px' });
  assert.equal(t2.effect.shadow.card.$value, 'box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.125);');

  const figmaLike = { name: 'Kit', variables: [{ name: 'color/brand', value: '#3366ff' }], components: [{ name: 'Button', kind: 'COMPONENT_SET', nodeId: '1:2' }] };
  const { tokens: t3, components } = toDesignSystem(fromHtml(`<script type="application/json">${JSON.stringify(figmaLike)}</script>`));
  assert.equal(t3.variables.color.brand.$value, 'rgba(51, 102, 255, 1)');
  assert.equal(components[0].nodeId, '1:2');

  assert.throws(() => fromHtml('<h1>Colours</h1><p>Brand: #3366ff</p>'), /no design data/);
  assert.throws(() => fromHtml('<style>:root{--a: var(--missing)}</style>'), /does not define/);
});

test('cli: source + sync from an HTML export, with a components export; the lock records the origin', () => {
  const root = tmp();
  execFileSync('node', [CLI, 'init', '--name', 'Kit', '--prefix', 'acme'], { cwd: root });
  writeFileSync(join(root, 'spec.html'), '<style>:root { --color-brand: #3366ff; }</style>');
  const out = execFileSync('node', [CLI, 'source', 'spec.html', '--components', 'https://www.figma.com/design/FILEKEY123/Kit'], { cwd: root }).toString();
  assert.match(out, /the designer's HTML export `spec\.html`, components in Figma file `FILEKEY123`/);
  const cfg = JSON.parse(readFileSync(join(root, 'design-system.config.json'), 'utf8'));
  assert.equal(cfg.designSystem.source.kind, 'html');
  writeFileSync(join(root, 'design-system/source/figma-export.components.1.json'), JSON.stringify({ format: EXPORT_FORMAT, fileKey: 'FILEKEY123', components: EXPORT.components }));
  execFileSync('node', [CLI, 'sync', '--export', 'design-system/source/figma-export.components.1.json', '--label', 'DS-1'], { cwd: root });
  const lock = JSON.parse(readFileSync(join(root, paths.lock), 'utf8'));
  assert.equal(lock.source, 'html + plugin-export (1 components file)');
  assert.equal(lock.origin.kind, 'html');
  assert.match(lock.origin.htmlSha256, /^[0-9a-f]{64}$/);
  assert.equal(lock.counts.components, 2);
  execFileSync('node', [CLI, 'build'], { cwd: root });
  assert.match(readFileSync(join(root, 'src/styles/acme-tokens.css'), 'utf8'), /--acme-color-brand: rgba\(51, 102, 255, 1\);/);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /source: the designer's HTML export `spec\.html`/); // `source` refreshed the rules
  // tokens come from one place only
  writeFileSync(join(root, 'design-system/source/figma-export.tokens.json'), JSON.stringify(EXPORT));
  assert.throws(() => execFileSync('node', [CLI, 'sync', '--export', 'design-system/source/figma-export.tokens.json'], { cwd: root, stdio: 'pipe' }));
});

test('a 0.1 config with only figmaFileKey still works', () => {
  const root = tmp();
  writeJson(join(root, 'design-system.config.json'), { designSystem: { name: 'Kit', figmaFileKey: 'FILEKEY123' } });
  const cfg = loadConfig(root);
  assert.deepEqual([cfg.designSystem.source.kind, cfg.designSystem.figmaFileKey], ['figma-file', 'FILEKEY123']);
});
