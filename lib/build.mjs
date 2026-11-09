// Stage 1 · tokens → CSS. design-system/tokens/*.tokens.json (+ the project's proposals) → one generated CSS file of
// custom properties, and design-system/tokens/names.json for the gate. Names are the Figma path, lower-cased:
//   variables  color/brand/6           → --<prefix>-color-brand-6
//   paint      Gray/900(text)          → --<prefix>-paint-gray-900-text
//   text       Body/S/regular          → --<prefix>-text-body-s-regular (font shorthand) + -size / -line-height / -weight
//   effect     shadow/card             → --<prefix>-effect-shadow-card (box-shadow; -filter / -backdrop-filter for blurs)
// Variables with several modes: the default mode in :root, every other mode in [data-<collection>="<mode>"].
import { join } from 'node:path';
import { paths } from './config.mjs';
import { readJson, slug, walkTokens, writeJson, writeText } from './util.mjs';

const proposalOf = (t) => t.$extensions?.proposal;

export function build(cfg, tokenFiles) {
  const prefix = cfg.tokens.prefix;
  const lines = [];
  const modeBlocks = new Map(); // selector → lines
  const names = {};
  const name = (group, path) => `--${prefix}-${group === 'variables' ? '' : `${group}-`}${slug(path)}`;
  const ref = (aliasPath) => `var(--${prefix}-${slug(aliasPath.split('/'))})`;
  const add = (n, value, figma, group, status, note = '') => {
    if (names[n]) throw new Error(`token name collision: ${n} (${figma} and ${names[n].figma})`);
    names[n] = { figma, group, status };
    lines.push(`  ${n}: ${value};${note ? ` /* ${note} */` : ''}`);
  };
  for (const { tree, status } of tokenFiles) {
    for (const group of ['variables', 'paint', 'text', 'effect']) {
      const list = walkTokens(tree?.[group] ?? {});
      if (!list.length) continue;
      lines.push('', `  /* ---- ${status === 'proposed' ? 'proposed (pending the designer\'s approval)' : cfg.designSystem.name} · ${group} */`);
      for (const [path, t] of list) {
        const figma = path.join('/');
        const prop = proposalOf(t);
        const st = status === 'proposed' ? (prop?.status === 'needs-designer' ? 'needs-designer' : 'proposed') : 'pinned';
        const tag = status === 'proposed' ? [st === 'needs-designer' ? 'needs-designer (value kept until the designer decides)' : 'proposed', prop?.issue, prop?.alias ? `→ ${prop.alias}` : ''].filter(Boolean).join(' ') : '';
        const alias = prop?.alias ?? t.$extensions?.figma?.alias;
        if (group === 'variables') {
          const n = name(group, path);
          const value = alias ? ref(alias) : t.$type === 'string' && /font-?family/i.test(figma) ? `"${t.$value}"` : String(t.$value);
          add(n, value, figma, group, st, tag);
          for (const [mode, v] of Object.entries(t.$extensions?.figma?.modes ?? {})) {
            if (mode === t.$extensions.figma.defaultMode) continue;
            const sel = `[data-${slug(t.$extensions.figma.collection ?? 'mode')}="${slug(mode)}"]`;
            if (!modeBlocks.has(sel)) modeBlocks.set(sel, []);
            modeBlocks.get(sel).push(`  ${n}: ${v.alias ? ref(v.alias) : v.value};`);
          }
        } else if (group === 'paint') {
          if (t.$type === 'empty') continue;
          add(name(group, path), alias ? ref(alias) : String(t.$value), figma, group, st, tag);
        } else if (group === 'text') {
          const v = t.$value;
          const fam = `${v.fontFamily}`.includes(' ') ? `"${v.fontFamily}"` : v.fontFamily;
          const base = name(group, path);
          add(`${base}-size`, v.fontSize, figma, group, st);
          add(`${base}-line-height`, v.lineHeight, figma, group, st);
          add(`${base}-weight`, String(v.fontWeight), figma, group, st);
          if (v.letterSpacing && v.letterSpacing !== '0px') add(`${base}-letter-spacing`, v.letterSpacing, figma, group, st);
          add(base, `${v.fontWeight} ${v.fontSize}/${v.lineHeight} ${fam}`, figma, group, st, ['font shorthand', tag].filter(Boolean).join(' · '));
        } else if (group === 'effect') {
          const decls = String(t.$value)
            .split(/;\s*(?=[a-z-]+:)|;\s*$/)
            .map((d) => /^([a-z-]+):\s*([\s\S]*)$/.exec(d.trim()))
            .filter(Boolean);
          for (const [, p, value] of decls) add(`${name(group, path)}${p === 'box-shadow' ? '' : `-${p}`}`, value.replace(/\s+/g, ' ').replace(/;$/, ''), figma, group, st, [p === 'box-shadow' ? '' : p, tag].filter(Boolean).join(' · '));
        }
      }
    }
  }
  const modes = [...modeBlocks].map(([sel, l]) => `\n${sel} {\n${l.join('\n')}\n}`).join('\n');
  return { css: `:root {${lines.join('\n')}\n}\n${modes}`, names };
}

export function buildProject(cfg, root = cfg.root ?? '.') {
  const p = (f) => join(root, f);
  const lock = readJson(p(paths.lock), null);
  if (!lock) throw new Error(`${paths.lock} not found: run \`ds-workflow sync\` first`);
  const files = [{ tree: readJson(p(paths.tokens)), status: 'pinned' }];
  const proposed = readJson(p(cfg.tokens.proposed), null);
  if (proposed) files.push({ tree: proposed, status: 'proposed' });
  const { css, names } = build(cfg, files);
  writeText(
    p(cfg.tokens.css),
    `/* ${cfg.designSystem.name} tokens ${lock.label} (${lock.source}, ${lock.date}) — GENERATED by \`ds-workflow build\` from ${paths.dir}/tokens/.
 * Do not edit: change the design system in Figma (or a proposal in ${cfg.tokens.proposed}), then sync + build. */
${css}`,
  );
  writeJson(p(paths.names), { label: lock.label, prefix: cfg.tokens.prefix, names }, 1);
  const by = Object.values(names).reduce((a, n) => ((a[`${n.group}/${n.status}`] = (a[`${n.group}/${n.status}`] ?? 0) + 1), a), {});
  return { count: Object.keys(names).length, by, css: cfg.tokens.css };
}
