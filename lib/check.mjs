// The gate (run in CI and before every commit): code may use only tokens of the pinned design-system version.
// Hard failures:
//   • var(--<prefix>-…) that the pinned version (plus proposals) does not define
//   • font-family that is not a var(…) (outside @font-face)
//   • in the component library (check.componentDirs): px literals (0 and @media / @container conditions excepted) and
//     custom properties that are neither tokens nor defined in the same file
//   • component registry: unknown status; reuse / extend / approved pointing at a node id outside the pinned inventory;
//     proposed components not named <proposal prefix>/…; the same code id twice
//   • review ledger (review.ledger): well formed; nothing waiting for review is a node the designer marked Ready or
//     that is unconfirmed (changes to those go in a v2 beside them)
// Ratchet (check.baseline): per file, hard-coded colours (#hex, rgb(), hsl()) and literal values in the legacy token
// layers may only go down. `--update` lowers the baseline after a migration — never to hide new literals.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths, proposalCode } from './config.mjs';
import { checkLedger } from './review.mjs';
import { listFiles, readJson, stripComments, writeJson } from './util.mjs';

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const STYLE_EXT = /\.(css|scss|less)$/;
export const STATUSES = ['reuse', 'extend', 'proposed', 'approved', 'deprecated'];

export function check(cfg, root = cfg.root ?? '.') {
  const p = (f) => join(root, f);
  const errors = [];
  const prefix = cfg.tokens.prefix;
  const namesFile = readJson(p(paths.names), null);
  if (!namesFile) return { errors: [`${paths.names} not found: run \`ds-workflow sync\` and \`ds-workflow build\``], counts: {}, files: 0 };
  const names = new Set(Object.keys(namesFile.names));
  const generated = new Set([cfg.tokens.css]);
  const legacy = new Set(cfg.check.legacy ?? []);
  const files = listFiles(root, cfg.check.scan, cfg.check.extensions, cfg.check.ignore).filter((f) => !generated.has(f));
  const tokenRe = new RegExp(`var\\(\\s*(--${prefix}-[a-z0-9-]+)`, 'g');
  const inComponents = (f) => (cfg.check.componentDirs ?? []).some((d) => f === d || f.startsWith(`${d.replace(/\/$/, '')}/`));
  const counts = {};

  for (const f of files) {
    const style = STYLE_EXT.test(f);
    const text = stripComments(readFileSync(p(f), 'utf8'), style || f.endsWith('.vue') || f.endsWith('.svelte'));
    for (const m of text.matchAll(tokenRe)) if (!names.has(m[1])) errors.push(`${f}: ${m[1]} is not a token of ${namesFile.label}`);
    for (const m of text.replace(/@font-face\s*{[^}]*}/g, '').matchAll(/font-family\s*:\s*([^;}\n]+)/g)) {
      const v = m[1].trim();
      if (!/^var\(|^inherit\b|^initial\b|^unset\b/.test(v)) errors.push(`${f}: font-family "${v}" — use a font token`);
    }
    if (inComponents(f) && style) {
      const local = new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
      for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) if (!m[1].startsWith(`--${prefix}-`) && !local.has(m[1])) errors.push(`${f}: ${m[1]} — components use --${prefix}-* tokens only`);
      for (const m of text.replace(/@(?:media|container)[^{]*/g, '').matchAll(/(?<![\w.-])(\d*\.?\d+)px\b/g)) if (Number(m[1]) !== 0) errors.push(`${f}: ${m[1]}px — use a --${prefix}-* size / space token`);
    }
    const entry = { colors: (text.match(COLOR) ?? []).length };
    if (legacy.has(f)) entry.legacyLiterals = [...text.matchAll(/--[a-z0-9-]+:\s*([^;]+);/g)].filter((m) => !/var\(/.test(m[1])).length;
    if (entry.colors || entry.legacyLiterals) counts[f] = entry;
  }

  const baseline = readJson(p(cfg.check.baseline), { files: {} }).files ?? {};
  for (const [f, c] of Object.entries(counts)) {
    const b = baseline[f] ?? { colors: 0, legacyLiterals: 0 };
    if (c.colors > (b.colors ?? 0)) errors.push(`${f}: ${c.colors} hard-coded colour(s) (baseline ${b.colors ?? 0}) — use --${prefix}-* tokens`);
    if ((c.legacyLiterals ?? 0) > (b.legacyLiterals ?? 0)) errors.push(`${f}: ${c.legacyLiterals} literal legacy token(s) (baseline ${b.legacyLiterals ?? 0}) — alias a token or propose one`);
  }

  errors.push(...checkRegistry(cfg, root));
  errors.push(...checkLedger(cfg, root));
  return { errors, counts, files: files.length };
}

export function checkRegistry(cfg, root = cfg.root ?? '.') {
  const p = (f) => join(root, f);
  const errors = [];
  if (!existsSync(p(paths.registry))) return errors;
  const inventory = new Set(readJson(p(paths.inventory), []).map((c) => c.nodeId));
  const reg = readJson(p(paths.registry));
  const code = proposalCode(cfg);
  const seen = new Set();
  for (const c of reg.components ?? []) {
    if (!STATUSES.includes(c.status)) errors.push(`registry ${c.code}: unknown status ${c.status}`);
    if (seen.has(c.code)) errors.push(`registry ${c.code}: listed twice`);
    seen.add(c.code);
    // `figmaPending`: a component the designer made after the pinned version — allowed until the next sync
    if (['extend', 'approved'].includes(c.status) || (c.status === 'reuse' && c.figma))
      if (!c.figma || !inventory.has(c.figma.nodeId)) errors.push(`registry ${c.code}: ${c.status} needs figma.nodeId from ${paths.inventory} (a component newer than the pinned version goes in figmaPending)`);
    if (c.status === 'proposed' && !c.code.startsWith(`${code}/`)) errors.push(`registry ${c.code}: proposed components are named ${code}/… (${cfg.proposal.prefix}/… in Figma)`);
  }
  return errors;
}

export function updateBaseline(cfg, counts, root = cfg.root ?? '.') {
  writeJson(join(root, cfg.check.baseline), { note: 'ratchet: counts may only go down (ds-workflow check)', files: counts }, 1);
}
