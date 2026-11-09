// A design system the designer exported as an HTML page → the normalised export (EXPORT_FORMAT), so `pin` treats it
// like a Figma export. The page is read as text, never run. What it may carry, in this order of preference:
//   1. <script type="application/json"> holding a ds-workflow export, or Figma-like data
//      ({ variables: [{ name, valuesByMode | value, type }], paintStyles, textStyles, effectStyles, components })
//   2. <script type="application/json"> holding DTCG design tokens ({ "$type", "$value" } leaves; {a.b} aliases;
//      typography and shadow composites become text / effect styles)
//   3. CSS custom properties declared in <style> blocks (:root { --color-brand-6: #3366ff; })
// Anything else: the page is only for people to read — ask the designer for one of the three, or sync from Figma.
import { EXPORT_FORMAT } from './sync.mjs';
import { walkTokens } from './util.mjs';

const COL = 'html';
const MODE = 'default';

/** CSS colour → {r,g,b,a} (0–1), or null when it is not a plain colour */
export function parseColor(v) {
  const s = String(v).trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const ch = (x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255);
    const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a };
  }
  return null;
}

const px = (v) => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'value' in v) return v.unit === 'rem' ? v.value * 16 : v.value;
  const m = /^(-?[\d.]+)(px|rem)?$/.exec(String(v).trim());
  return m ? parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) : null;
};

function jsonBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/type\s*=\s*["']?application\/(?:ld\+)?json/i.test(m[1])) continue;
    try {
      out.push({ attrs: m[1], data: JSON.parse(m[2]) });
    } catch {
      /* not JSON after all */
    }
  }
  return out;
}

/** one variable from a name and a CSS / DTCG value; aliases resolved later */
function variable(name, raw, hint) {
  const v = { id: name, name, collectionId: COL };
  const alias = typeof raw === 'string' && (/^\{(.+)\}$/.exec(raw.trim())?.[1]?.split('.').join('/') ?? /^var\(\s*--([\w-]+)\s*\)$/.exec(raw.trim())?.[1]);
  if (alias) return { ...v, type: hint ?? 'ALIAS', aliasTo: alias };
  const c = hint === 'STRING' ? null : parseColor(raw);
  if (c) return { ...v, type: 'COLOR', valuesByMode: { [MODE]: c } };
  const n = hint === 'STRING' ? null : px(raw);
  if (n != null) return { ...v, type: 'FLOAT', valuesByMode: { [MODE]: n }, ...(/px|rem/.test(String(raw)) || (raw && typeof raw === 'object') ? {} : { scopes: ['OPACITY'] }) };
  return { ...v, type: 'STRING', valuesByMode: { [MODE]: Array.isArray(raw) ? raw.join(', ') : String(raw) } };
}

function finish(vars, extra = {}) {
  const byName = new Map(vars.map((v) => [v.name, v]));
  for (const v of vars) {
    if (!v.aliasTo) continue;
    const t = byName.get(v.aliasTo) ?? byName.get(v.aliasTo.split('/').join('-'));
    if (!t) throw new Error(`"${v.name}" refers to "${v.aliasTo}", which the page does not define`);
    v.type = t.type === 'ALIAS' ? 'STRING' : t.type;
    v.valuesByMode = { [MODE]: { type: 'VARIABLE_ALIAS', id: t.id } };
    delete v.aliasTo;
  }
  return {
    format: EXPORT_FORMAT,
    fileName: extra.fileName,
    exportedAt: extra.exportedAt ?? new Date().toISOString(),
    source: 'html',
    collections: vars.length ? [{ id: COL, name: 'HTML export', defaultModeId: MODE, modes: [{ modeId: MODE, name: 'Default' }] }] : [],
    variables: vars,
    paintStyles: extra.paintStyles ?? [],
    textStyles: extra.textStyles ?? [],
    effectStyles: extra.effectStyles ?? [],
    components: extra.components ?? [],
  };
}

/** DTCG tree → variables + text / effect styles */
function fromDtcg(tree) {
  const vars = [];
  const textStyles = [];
  const effectStyles = [];
  const all = walkTokens(tree);
  const lookup = new Map(all.map(([path, t]) => [path.join('.'), t]));
  const deref = (x, depth = 0) => {
    const m = typeof x === 'string' && /^\{(.+)\}$/.exec(x.trim());
    return m && depth < 10 && lookup.has(m[1]) ? deref(lookup.get(m[1]).$value, depth + 1) : x;
  };
  for (const [path, t] of all) {
    const name = path.join('/');
    const type = t.$type ?? '';
    if (type === 'typography') {
      const v = Object.fromEntries(Object.entries(t.$value ?? {}).map(([k, x]) => [k, deref(x)]));
      const size = px(v.fontSize) ?? 16;
      const lh = px(v.lineHeight);
      textStyles.push({
        id: name,
        name,
        fontFamily: Array.isArray(v.fontFamily) ? v.fontFamily[0] : v.fontFamily,
        fontWeight: Number(v.fontWeight) || undefined,
        fontSize: size,
        lineHeight: lh == null ? null : typeof v.lineHeight === 'number' && v.lineHeight < 5 ? { unit: 'PERCENT', value: v.lineHeight * 100 } : { unit: 'PIXELS', value: lh },
        letterSpacing: px(v.letterSpacing) ?? 0,
      });
    } else if (type === 'shadow') {
      const list = (Array.isArray(t.$value) ? t.$value : [t.$value]).map((s) => Object.fromEntries(Object.entries(s ?? {}).map(([k, x]) => [k, deref(x)])));
      effectStyles.push({
        id: name,
        name,
        effects: list.map((s) => ({ type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', visible: true, color: parseColor(s.color) ?? { r: 0, g: 0, b: 0, a: 0 }, offset: { x: px(s.offsetX) ?? 0, y: px(s.offsetY) ?? 0 }, radius: px(s.blur) ?? 0, spread: px(s.spread) ?? 0 })),
      });
    } else {
      const hint = type === 'fontFamily' || type === 'string' ? 'STRING' : undefined;
      vars.push(variable(name, t.$value, hint));
    }
  }
  return finish(vars, { textStyles, effectStyles });
}

const isDtcg = (o) => !!o && typeof o === 'object' && walkTokens(o).length > 0;
const looksFigma = (o) => o && typeof o === 'object' && ['variables', 'paintStyles', 'textStyles', 'effectStyles', 'components'].some((k) => Array.isArray(o[k]));

export function fromHtml(html) {
  for (const { data } of jsonBlocks(html)) {
    if (data?.format === EXPORT_FORMAT) return { ...data, source: 'html' };
    if (looksFigma(data)) {
      // Figma-like data: variables with valuesByMode pass through; { name, value } become one-mode variables
      const simple = (data.variables ?? []).filter((v) => !v.valuesByMode);
      const passthrough = (data.variables ?? []).filter((v) => v.valuesByMode);
      const exp = finish(simple.map((v) => variable(v.name, v.value, v.type === 'STRING' ? 'STRING' : undefined)), {
        fileName: data.fileName ?? data.name,
        paintStyles: data.paintStyles,
        textStyles: data.textStyles,
        effectStyles: data.effectStyles,
        components: data.components,
      });
      if (passthrough.length) {
        exp.collections.push(...(data.collections ?? []));
        exp.variables.push(...passthrough);
      }
      return exp;
    }
    if (isDtcg(data)) return fromDtcg(data);
  }
  const vars = new Map();
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    for (const d of m[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|[;{\s])--([\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(d[1])) vars.set(d[1], d[2].trim());
  if (vars.size) return finish([...vars].map(([n, v]) => variable(n, v)));
  throw new Error(
    'the HTML page has no design data ds-workflow can read: no <script type="application/json"> with tokens or Figma data, and no CSS custom properties in <style>. Ask the designer for an export that embeds one of them, or sync from the Figma file.',
  );
}

