// ds-workflow · Figma plugin-API export of a design-system library (format "ds-workflow-figma-export-1").
//
// Run through the Figma MCP `use_figma` tool (Codex, Cursor, Claude Code… — any agent with the Figma MCP server), on
// the library file. Read-only. Works on every Figma plan and sees local, unpublished variables and styles.
//
// `use_figma` returns at most ~48 KB, so the export comes in parts and chunks. Edit only the three lines below and
// save every return value verbatim as JSON under design-system/source/:
//   PART = 'pages'                              → lists the pages (nothing to save; pick the ones with library components)
//   PART = 'variables',  CHUNK = 0, 1, …        → figma-export.variables.<CHUNK>.json
//   PART = 'styles',     CHUNK = 0, 1, …        → figma-export.styles.<CHUNK>.json
//   PART = 'components', PAGE_ID = '<id>', CHUNK = 0, 1, …  → figma-export.components.<page id>.<CHUNK>.json
// Each return says `chunk` / `chunks`: repeat with the next CHUNK until chunk + 1 === chunks.
// Then: npx ds-workflow sync --export 'design-system/source/figma-export.*.json' --label <version label>
const PART = 'variables'; // 'pages' | 'variables' | 'styles' | 'components'
const CHUNK = 0;
const PAGE_ID = ''; // for PART = 'components'

const FORMAT = 'ds-workflow-figma-export-1';
const LIMIT = 40000; // bytes per return, under the use_figma limit
const r4 = (n) => (typeof n === 'number' ? Math.round(n * 10000) / 10000 : n);
const color = (c) => c && { r: r4(c.r), g: r4(c.g), b: r4(c.b), a: r4(c.a ?? 1) };
const clean = (o) => JSON.parse(JSON.stringify(o)); // drops undefined
const desc = (d) => (d ? d.slice(0, 160) : undefined); // descriptions are context only; keep returns small
const base = { format: FORMAT, fileKey: figma.fileKey, fileName: figma.root.name, exportedAt: new Date().toISOString(), part: PART };

/** split the array fields into chunks of at most LIMIT bytes; return chunk CHUNK */
function page(fixed, lists) {
  const chunks = [];
  let cur = {};
  let size = JSON.stringify({ ...base, ...fixed }).length + 200;
  for (const [field, items] of Object.entries(lists)) {
    for (const it of items) {
      const n = JSON.stringify(it).length + 1;
      if (size + n > LIMIT && Object.keys(cur).length) {
        chunks.push(cur);
        cur = {};
        size = JSON.stringify({ ...base, ...fixed }).length + 200;
      }
      (cur[field] ??= []).push(it);
      size += n;
    }
  }
  chunks.push(cur);
  if (CHUNK >= chunks.length) throw new Error(`CHUNK ${CHUNK} out of range: ${chunks.length} chunk(s)`);
  return { ...base, ...fixed, chunk: CHUNK, chunks: chunks.length, ...chunks[CHUNK] };
}

if (PART === 'pages') {
  return { ...base, pages: figma.root.children.map((p) => ({ id: p.id, name: p.name })) };
}

if (PART === 'variables') {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const out = variables.map((v) => {
    const valuesByMode = {};
    for (const [modeId, val] of Object.entries(v.valuesByMode)) {
      const one = (x) => (x && typeof x === 'object' ? (x.type === 'VARIABLE_ALIAS' ? { type: 'VARIABLE_ALIAS', id: x.id } : color(x)) : r4(x));
      // a colour may be stored as { color: <alias | rgba>, opacity: <percent> } (alias with opacity)
      valuesByMode[modeId] = val && typeof val === 'object' && 'color' in val ? { ...one(val.color), opacity: r4(val.opacity / 100) } : one(val);
    }
    return clean({ id: v.id, name: v.name, collectionId: v.variableCollectionId, type: v.resolvedType, scopes: v.scopes, description: desc(v.description), valuesByMode });
  });
  return page(
    { collections: collections.map((c) => ({ id: c.id, name: c.name, defaultModeId: c.defaultModeId, modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })) })) },
    { variables: out },
  );
}

if (PART === 'styles') {
  const names = new Map();
  const aliasOf = async (id) => {
    if (!names.has(id)) names.set(id, (await figma.variables.getVariableByIdAsync(id))?.name ?? id);
    return names.get(id);
  };
  const paintStyles = [];
  for (const s of await figma.getLocalPaintStylesAsync()) {
    const paints = [];
    for (const p of s.paints) {
      const q = { type: p.type, visible: p.visible === false ? false : undefined, opacity: p.opacity === 1 ? undefined : r4(p.opacity) };
      if (p.type === 'SOLID') {
        q.color = color({ ...p.color, a: 1 });
        if (p.boundVariables && p.boundVariables.color) q.alias = await aliasOf(p.boundVariables.color.id);
      } else if (p.type.startsWith('GRADIENT')) {
        q.gradientStops = p.gradientStops.map((g) => ({ position: r4(g.position), color: color(g.color) }));
        const t = p.gradientTransform; // gradient handles: start and end of the gradient axis
        if (t) q.gradientHandlePositions = [{ x: r4(t[0][2]), y: r4(t[1][2]) }, { x: r4(t[0][0] + t[0][2]), y: r4(t[1][0] + t[1][2]) }];
      }
      paints.push(q);
    }
    paintStyles.push(clean({ id: s.id, key: s.key, name: s.name, description: desc(s.description), paints }));
  }
  const textStyles = (await figma.getLocalTextStylesAsync()).map((s) =>
    clean({
      id: s.id,
      key: s.key,
      name: s.name,
      description: desc(s.description),
      fontFamily: s.fontName.family,
      fontStyle: s.fontName.style,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight.unit === 'AUTO' ? null : { unit: s.lineHeight.unit, value: r4(s.lineHeight.value) },
      letterSpacing: { unit: s.letterSpacing.unit, value: r4(s.letterSpacing.value) },
    }),
  );
  const effectStyles = (await figma.getLocalEffectStylesAsync()).map((s) =>
    clean({
      id: s.id,
      key: s.key,
      name: s.name,
      description: desc(s.description),
      effects: s.effects.map((e) => ({ type: e.type, visible: e.visible === false ? false : undefined, radius: r4(e.radius), spread: r4(e.spread), offset: e.offset && { x: r4(e.offset.x), y: r4(e.offset.y) }, color: color(e.color) })),
    }),
  );
  return page({}, { paintStyles, textStyles, effectStyles });
}

if (PART === 'components') {
  const pg = await figma.getNodeByIdAsync(PAGE_ID);
  if (!pg || pg.type !== 'PAGE') throw new Error(`PAGE_ID ${PAGE_ID} is not a page — run PART = 'pages' first`);
  await figma.setCurrentPageAsync(pg);
  const components = [];
  for (const n of pg.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) {
    if (n.type === 'COMPONENT' && n.parent && n.parent.type === 'COMPONENT_SET') continue; // variants belong to their set
    const props = {};
    for (const [k, d] of Object.entries(n.componentPropertyDefinitions)) props[k.replace(/#[\d:]+$/, '')] = d.type === 'VARIANT' ? { type: d.type, values: d.variantOptions } : { type: d.type };
    let frame;
    for (let p = n.parent; p && p.type !== 'PAGE'; p = p.parent) frame = p.name;
    components.push(clean({ name: n.name, kind: n.type, nodeId: n.id, key: n.key, page: pg.name, frame, description: desc(n.description), properties: props }));
  }
  return page({ page: { id: pg.id, name: pg.name } }, { components });
}

throw new Error(`unknown PART ${PART}`);
