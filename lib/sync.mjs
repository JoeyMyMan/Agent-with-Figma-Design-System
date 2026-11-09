// Stage 1 · sync and pin. Three inputs, one normalised shape ("ds-workflow-figma-export-1"):
//   • the Figma plugin-API export (figma/export-design-system.js, run through the Figma MCP `use_figma` tool by any
//     agent — every plan; sees local, unpublished styles and variables)
//   • the Figma REST API (FIGMA_TOKEN; variables need Enterprise `file_variables:read`; styles / components the REST API
//     returns are the *published* ones only)
//   • the designer's HTML export (lib/html.mjs), optionally merged with a plugin export of the components file
// Output (never edited by hand): design-system/tokens/design-system.tokens.json (DTCG), components.inventory.json,
// lock.json, and design-system/migrations/<old>→<new>.md when a previous version was pinned.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from './config.mjs';
import { diffReport } from './diff.mjs';
import { pathOf, putToken, readJson, rgba, sha256, today, writeJson, writeText } from './util.mjs';

export const EXPORT_FORMAT = 'ds-workflow-figma-export-1';

const WEIGHTS = { thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 };
export const weightOf = (style = '') => WEIGHTS[style.toLowerCase().replace(/[\s_-]|italic|oblique/g, '')] ?? 400;

const UNITLESS_SCOPES = new Set(['OPACITY', 'FONT_WEIGHT']);
const unitless = (v) => (v.scopes?.length && v.scopes.every((s) => UNITLESS_SCOPES.has(s))) || /opacity|weight|z-?index|ratio|scale/i.test(v.name);

function floatValue(v, raw) {
  if (typeof raw !== 'number') return raw;
  const n = +raw.toFixed(4);
  return unitless(v) ? n : `${n}px`;
}

function rawValue(v, raw) {
  // REST / plugin "alias with opacity": { color: <alias | rgba>, opacity } (plugin export already flattens it)
  if (raw && typeof raw === 'object' && 'color' in raw) raw = { ...raw.color, opacity: raw.opacity > 1 ? raw.opacity / 100 : raw.opacity };
  if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') return raw;
  if (v.type === 'COLOR') return rgba(raw, raw?.opacity ?? 1);
  if (v.type === 'FLOAT') return floatValue(v, raw);
  return raw;
}

const shadowCss = (e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${rgba(e.color ?? { r: 0, g: 0, b: 0, a: 0 })}`;

function effectCss(effects) {
  const vis = (effects ?? []).filter((e) => e.visible !== false);
  const decl = [];
  const shadows = vis.filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW').map(shadowCss);
  if (shadows.length) decl.push(`box-shadow: ${shadows.join(', ')};`);
  const layer = vis.find((e) => e.type === 'LAYER_BLUR');
  if (layer) decl.push(`filter: blur(${layer.radius}px);`);
  const bg = vis.find((e) => e.type === 'BACKGROUND_BLUR');
  if (bg) decl.push(`backdrop-filter: blur(${bg.radius}px);`);
  return decl.join(' ');
}

function gradientCss(p) {
  const stops = (p.gradientStops ?? []).map((s) => `${rgba(s.color, p.opacity ?? 1)} ${+(s.position * 100).toFixed(2)}%`).join(', ');
  const h = p.gradientHandlePositions;
  let angle = 90;
  if (h?.length >= 2) angle = Math.round((Math.atan2(h[1].y - h[0].y, h[1].x - h[0].x) * 180) / Math.PI + 90);
  if (p.type === 'GRADIENT_RADIAL') return `radial-gradient(${stops})`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

function paintToken(paints) {
  const top = [...(paints ?? [])].reverse().find((p) => p.visible !== false);
  if (!top) return { $type: 'empty', $value: null };
  if (top.type === 'SOLID') return { $type: 'color', $value: rgba(top.color, top.opacity ?? 1), alias: top.alias };
  if (top.type?.startsWith('GRADIENT')) return { $type: 'gradient', $value: gradientCss(top) };
  return { $type: 'empty', $value: null, note: top.type };
}

function lineHeight(lh, size) {
  if (lh == null) return 'normal';
  if (typeof lh === 'number') return `${+lh.toFixed(2)}px`;
  if (lh.unit === 'PIXELS') return `${+lh.value.toFixed(2)}px`;
  if (lh.unit === 'PERCENT') return `${+((lh.value / 100) * size).toFixed(2)}px`;
  return 'normal';
}
const letterSpacing = (ls, size) => (ls == null ? '0px' : typeof ls === 'number' ? `${ls}px` : ls.unit === 'PERCENT' ? `${+((ls.value / 100) * size).toFixed(3)}px` : `${ls.value}px`);

/** normalised export → DTCG tokens + component inventory */
export function toDesignSystem(exp) {
  if (exp.format !== EXPORT_FORMAT) throw new Error(`not a ${EXPORT_FORMAT} file (format: ${exp.format})`);
  const collections = new Map((exp.collections ?? []).map((c) => [c.id, c]));
  const vars = exp.variables ?? [];
  const byId = new Map(vars.map((v) => [v.id, v]));
  // the same variable name in two collections → prefix the collection to keep both
  const nameCount = vars.reduce((m, v) => m.set(v.name, (m.get(v.name) ?? 0) + 1), new Map());
  const tokenPath = (v) => (nameCount.get(v.name) > 1 ? [collections.get(v.collectionId)?.name ?? 'collection', ...pathOf(v.name)] : pathOf(v.name));
  const aliasName = (id) => (byId.has(id) ? tokenPath(byId.get(id)).join('/') : `unresolved:${id}`);
  /** the default-mode colour of a variable, following aliases, times `opacity` */
  const resolveColor = (id, opacity = 1, depth = 0) => {
    const t = byId.get(id);
    if (!t || depth > 10) return `unresolved:${id}`;
    const col = collections.get(t.collectionId);
    let raw = t.valuesByMode?.[col?.defaultModeId ?? Object.keys(t.valuesByMode ?? {})[0]];
    if (raw && typeof raw === 'object' && 'color' in raw) raw = { ...raw.color, opacity: raw.opacity > 1 ? raw.opacity / 100 : raw.opacity };
    if (raw?.type === 'VARIABLE_ALIAS') return resolveColor(raw.id, opacity * (raw.opacity ?? 1), depth + 1);
    return rgba(raw, opacity * (raw?.opacity ?? 1));
  };

  const variables = {};
  for (const v of vars) {
    const col = collections.get(v.collectionId);
    const modes = col?.modes ?? [];
    const defId = col?.defaultModeId ?? Object.keys(v.valuesByMode ?? {})[0];
    const out = (raw) => {
      const val = rawValue(v, raw);
      if (!(val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS')) return { value: val };
      // an alias with opacity cannot be a plain var(): resolve it to the colour, keep the alias for the record
      if (val.opacity != null && val.opacity !== 1) return { value: resolveColor(val.id, val.opacity), aliasOf: aliasName(val.id), aliasOpacity: val.opacity };
      return { alias: aliasName(val.id) };
    };
    const def = out(v.valuesByMode?.[defId]);
    const figma = { collection: col?.name, type: v.type, scopes: v.scopes, ...(v.description ? { description: v.description } : {}) };
    if (def.alias) figma.alias = def.alias;
    if (def.aliasOf) Object.assign(figma, { aliasOf: def.aliasOf, aliasOpacity: def.aliasOpacity });
    // record modes only when they differ (a one-value variable in a two-mode collection is just a value)
    const perMode = modes.map((m) => [m.name, out(v.valuesByMode?.[m.modeId])]);
    if (modes.length > 1 && perMode.some(([, x]) => JSON.stringify(x) !== JSON.stringify(def))) {
      figma.defaultMode = modes.find((m) => m.modeId === defId)?.name;
      figma.modes = Object.fromEntries(perMode);
    }
    putToken(variables, tokenPath(v), {
      $type: v.type === 'COLOR' ? 'color' : v.type === 'FLOAT' ? (unitless(v) ? 'number' : 'dimension') : v.type === 'BOOLEAN' ? 'boolean' : 'string',
      $value: def.alias ? `{${def.alias.split('/').join('.')}}` : def.value,
      $extensions: { figma },
    });
  }

  const paint = {};
  for (const s of exp.paintStyles ?? []) {
    const t = paintToken(s.paints);
    putToken(paint, pathOf(s.name), { $type: t.$type, $value: t.$value, $extensions: { figma: { key: s.key, ...(t.alias ? { alias: t.alias } : {}), ...(s.description ? { description: s.description } : {}) } } });
  }
  const text = {};
  for (const s of exp.textStyles ?? []) {
    putToken(text, pathOf(s.name), {
      $type: 'typography',
      $value: {
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight ?? weightOf(s.fontStyle),
        fontSize: `${s.fontSize}px`,
        lineHeight: lineHeight(s.lineHeight, s.fontSize),
        letterSpacing: letterSpacing(s.letterSpacing, s.fontSize),
      },
      $extensions: { figma: { key: s.key, fontStyle: s.fontStyle, ...(s.description ? { description: s.description } : {}) } },
    });
  }
  const effect = {};
  for (const s of exp.effectStyles ?? []) {
    const css = effectCss(s.effects);
    if (css) putToken(effect, pathOf(s.name), { $type: 'shadow', $value: css, $extensions: { figma: { key: s.key, ...(s.description ? { description: s.description } : {}) } } });
  }
  const tokens = { $description: `${exp.fileName ?? 'Figma'} design system — generated by ds-workflow sync, do not edit`, variables, paint, text, effect };
  const components = (exp.components ?? [])
    .map((c) => ({ name: c.name, kind: c.kind, nodeId: c.nodeId, ...(c.key ? { key: c.key } : {}), ...(c.page ? { page: c.page } : {}), ...(c.frame ? { frame: c.frame } : {}), ...(c.properties ? { properties: c.properties } : {}), ...(c.description ? { description: c.description } : {}) }))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId, 'en', { numeric: true }));
  return { tokens, components };
}

/** merge several plugin-export parts (tokens part + one components part per page) */
export function mergeExports(parts) {
  const base = { format: EXPORT_FORMAT, collections: [], variables: [], paintStyles: [], textStyles: [], effectStyles: [], components: [] };
  for (const p of parts) {
    if (p.format !== EXPORT_FORMAT) throw new Error(`not a ${EXPORT_FORMAT} file (format: ${p.format})`);
    for (const k of ['fileKey', 'fileName', 'exportedAt', 'version']) if (p[k] && !base[k]) base[k] = p[k];
    if (p.fileKey && base.fileKey && p.fileKey !== base.fileKey) throw new Error(`exports from two files: ${base.fileKey} and ${p.fileKey}`);
    for (const k of ['collections', 'variables', 'paintStyles', 'textStyles', 'effectStyles', 'components']) {
      const seen = new Set(base[k].map((x) => x.id ?? x.nodeId));
      for (const x of p[k] ?? []) if (!seen.has(x.id ?? x.nodeId)) base[k].push(x);
    }
  }
  return base;
}

// ---- REST API → normalised export
export async function fromRest(fileKey, token, fetchImpl = fetch) {
  const get = async (path) => {
    const r = await fetchImpl(`https://api.figma.com/v1/${path}`, { headers: { 'X-Figma-Token': token } });
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status} ${await r.text()}`);
    return r.json();
  };
  const file = await get(`files/${fileKey}?depth=1`);
  const versions = await get(`files/${fileKey}/versions`);
  const head = versions.versions?.[0];
  let variables = [];
  let collections = [];
  try {
    const v = (await get(`files/${fileKey}/variables/local`)).meta;
    collections = Object.values(v.variableCollections ?? {}).filter((c) => !c.remote).map((c) => ({ id: c.id, name: c.name, defaultModeId: c.defaultModeId, modes: c.modes }));
    variables = Object.values(v.variables ?? {}).filter((x) => !x.remote).map((x) => ({ id: x.id, name: x.name, collectionId: x.variableCollectionId, type: x.resolvedType, scopes: x.scopes, description: x.description, valuesByMode: x.valuesByMode }));
  } catch (e) {
    // not Enterprise / no file_variables:read: keep going, say so in the lock
    variables = null;
    collections = [];
    console.warn(`variables not read (${e.message.split('\n')[0]}); use the plugin export for variables`);
  }
  const styles = (await get(`files/${fileKey}/styles`)).meta.styles ?? [];
  const nodes = {};
  for (let i = 0; i < styles.length; i += 100) {
    const ids = styles.slice(i, i + 100).map((s) => s.node_id).join(',');
    Object.assign(nodes, (await get(`files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`)).nodes);
  }
  const doc = (s) => nodes[s.node_id]?.document ?? {};
  const meta = (s) => ({ id: s.node_id, key: s.key, name: s.name, description: s.description });
  const paintStyles = styles.filter((s) => s.style_type === 'FILL').map((s) => ({ ...meta(s), paints: doc(s).fills }));
  const textStyles = styles
    .filter((s) => s.style_type === 'TEXT')
    .map((s) => {
      const st = doc(s).style ?? {};
      return {
        ...meta(s),
        fontFamily: st.fontFamily,
        fontStyle: st.fontPostScriptName?.split('-')[1] ?? (st.italic ? 'Italic' : ''),
        fontWeight: st.fontWeight,
        fontSize: st.fontSize,
        lineHeight: st.lineHeightUnit === 'INTRINSIC_%' ? null : st.lineHeightPx,
        letterSpacing: st.letterSpacing,
      };
    });
  const effectStyles = styles.filter((s) => s.style_type === 'EFFECT').map((s) => ({ ...meta(s), effects: doc(s).effects }));
  const sets = (await get(`files/${fileKey}/component_sets`)).meta.component_sets ?? [];
  const comps = (await get(`files/${fileKey}/components`)).meta.components ?? [];
  const components = [
    ...sets.map((c) => ({ name: c.name, kind: 'COMPONENT_SET', nodeId: c.node_id, key: c.key, page: c.containing_frame?.pageName, frame: c.containing_frame?.name, description: c.description })),
    ...comps.filter((c) => !c.containing_frame?.containingComponentSet).map((c) => ({ name: c.name, kind: 'COMPONENT', nodeId: c.node_id, key: c.key, page: c.containing_frame?.pageName, frame: c.containing_frame?.name, description: c.description })),
  ];
  return {
    format: EXPORT_FORMAT,
    fileKey,
    fileName: file.name,
    exportedAt: new Date().toISOString(),
    source: 'rest',
    variablesUnavailable: variables === null,
    version: head ? { id: head.id, label: head.label, date: head.created_at?.slice(0, 10) } : undefined,
    collections,
    variables: variables ?? [],
    paintStyles,
    textStyles,
    effectStyles,
    components,
  };
}

/** write tokens / inventory / lock (+ migration report) for a normalised export */
export function pin(cfg, exp, { label, source, origin, root = cfg.root ?? '.' } = {}) {
  const p = (f) => join(root, f);
  const { tokens, components } = toDesignSystem(exp);
  const prevLock = readJson(p(paths.lock), null);
  const prevTokens = readJson(p(paths.tokens), null);
  const prevInv = readJson(p(paths.inventory), null);
  const tokensText = JSON.stringify(tokens, null, 2) + '\n';
  const invText = JSON.stringify(components, null, 1) + '\n';
  const date = exp.version?.date ?? exp.exportedAt?.slice(0, 10) ?? today();
  const lock = {
    designSystem: cfg.designSystem.name,
    figmaFileKey: exp.fileKey ?? cfg.designSystem.figmaFileKey,
    label: label ?? exp.version?.label ?? `DS-${date}`,
    source,
    ...(origin ? { origin } : cfg.designSystem.source ? { origin: originOf(cfg.designSystem.source) } : {}),
    date,
    ...(exp.version?.id ? { figmaVersionId: exp.version.id } : {}),
    ...(exp.variablesUnavailable ? { warning: 'variables not read from the REST API (needs Enterprise); run the plugin export' } : {}),
    syncedAt: today(),
    counts: { variables: exp.variables?.length ?? 0, paintStyles: exp.paintStyles?.length ?? 0, textStyles: exp.textStyles?.length ?? 0, effectStyles: exp.effectStyles?.length ?? 0, components: components.length },
    outputs: { [paths.tokens]: sha256(tokensText), [paths.inventory]: sha256(invText) },
    previous: prevLock ? { label: prevLock.label, date: prevLock.date } : null,
  };
  if (cfg.designSystem.figmaFileKey && exp.fileKey && cfg.designSystem.figmaFileKey !== exp.fileKey)
    throw new Error(`the export is from ${exp.fileKey}, the config pins ${cfg.designSystem.figmaFileKey}`);
  let report = null;
  if (prevLock && prevTokens && (sha256(JSON.stringify(prevTokens, null, 2) + '\n') !== sha256(tokensText) || JSON.stringify(prevInv) !== JSON.stringify(components))) {
    report = `${paths.migrations}/${prevLock.label}→${lock.label}.md`;
    writeText(p(report), diffReport({ from: prevLock.label, to: lock.label, oldTokens: prevTokens, newTokens: tokens, oldInv: prevInv ?? [], newInv: components }));
  }
  writeText(p(paths.tokens), tokensText);
  writeText(p(paths.inventory), invText);
  writeJson(p(paths.lock), lock);
  return { lock, report, components: components.length };
}

/** what the lock records about where the design system came from (no secrets: links and keys only) */
export function originOf(src, extra = {}) {
  const keep = ['kind', 'url', 'fileKey', 'nodeId', 'communityUrl', 'license', 'html'];
  const o = Object.fromEntries(keep.filter((k) => src[k]).map((k) => [k, src[k]]));
  if (src.components) o.components = src.components.url ?? src.components.fileKey;
  if (src.workFile) o.workFile = src.workFile.url ?? src.workFile.fileKey;
  return { ...o, ...extra };
}

export function readExports(files) {
  return mergeExports(files.map((f) => JSON.parse(readFileSync(f, 'utf8'))));
}

export const hasLock = (root = '.') => existsSync(join(root, paths.lock));
