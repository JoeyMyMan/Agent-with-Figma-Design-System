// Where the design system comes from (config designSystem.source). Four kinds:
//   figma-file       any Figma design file or a link into it: figma.com/design/<fileKey>/<name>?node-id=<id>
//   figma-library    your team's library, published for other files (the Share → Copy link of the library file)
//   figma-community  a public kit from the Figma Community (Material 3, platform UI kits, Tailwind / shadcn / Ant
//                    Design kits…): figma.com/community/file/<id>/<name>. Tools cannot read it until someone
//                    duplicates it; the duplicate's link becomes fileKey, the Community link stays as the origin.
//   html             a design system the designer exported as an HTML page (lib/html.mjs), kept in the repo;
//                    optionally with a Figma file that holds the components (`components`)
// `workFile`: the Figma file where this project puts proposals and written-back screens, when it cannot or should
// not edit the source (a Community kit, a locked team library, an HTML export). Default: the source file.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { paths } from './config.mjs';

export const KINDS = ['figma-file', 'figma-library', 'figma-community', 'html'];
const NOT_DESIGN = { board: 'a FigJam board', slides: 'a Figma Slides deck', make: 'a Figma Make file', deck: 'a Figma Slides deck', proto: 'a prototype link', site: 'a Figma Sites file' };

/** a Figma link → { fileKey, fileName, nodeId, url } or { communityId, communityUrl } */
export function parseFigmaUrl(input) {
  if (/\s/.test(input.trim())) throw new Error(`a link has no spaces — quote it, and pass options separately: ${input}`);
  let u;
  try {
    u = new URL(input);
  } catch {
    throw new Error(`not a link: ${input}`);
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) throw new Error(`not a Figma link: ${input}`);
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'community') {
    if (parts[1] !== 'file' || !parts[2]) throw new Error('a Community link must point at a file (figma.com/community/file/<id>/<name>); plugins and widgets are not design systems');
    return { communityId: parts[2], communityName: parts[3] ?? '', communityUrl: `https://www.figma.com/community/file/${parts[2]}${parts[3] ? `/${encodeURIComponent(parts[3])}` : ''}` };
  }
  if (NOT_DESIGN[parts[0]]) throw new Error(`this is ${NOT_DESIGN[parts[0]]}, not a design file: open the design system file and copy its link (figma.com/design/…)`);
  if (parts[0] !== 'design' && parts[0] !== 'file') throw new Error(`unrecognised Figma link: ${input}`);
  // a branch link: the branch key is the file to read
  const branch = parts[2] === 'branch';
  const fileKey = branch ? parts[3] : parts[1];
  const fileName = (branch ? parts[4] : parts[2]) ?? '';
  if (!/^[A-Za-z0-9]{10,}$/.test(fileKey ?? '')) throw new Error(`no file key in ${input}`);
  const node = u.searchParams.get('node-id');
  const nodeId = node ? node.replace('-', ':') : undefined;
  // keep the link canonical: no tracking parameters (t=…, share ids)
  const url = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(fileName)}${nodeId ? `?node-id=${nodeId.replace(':', '-')}` : ''}`;
  return { fileKey, fileName, ...(nodeId ? { nodeId } : {}), url };
}

/**
 * `ds-workflow source <link | file.html>` → the config's designSystem.source.
 * opts: library (team library), fromCommunity (Community link the duplicate came from), license, components (Figma
 * link of the components file for an HTML source), workFile (Figma link), root
 */
export function resolveSource(input, opts = {}) {
  const root = opts.root ?? '.';
  let src;
  if (/^https?:\/\//i.test(input)) {
    const f = parseFigmaUrl(input);
    if (f.communityId) src = { kind: 'figma-community', communityUrl: f.communityUrl, fileKey: '' };
    else if (opts.fromCommunity) src = { kind: 'figma-community', communityUrl: parseFigmaUrl(opts.fromCommunity).communityUrl, ...f };
    else src = { kind: opts.library ? 'figma-library' : 'figma-file', ...f };
  } else if (/\.html?$/i.test(input)) {
    const abs = isAbsolute(input) ? input : resolve(root, input);
    if (!existsSync(abs)) throw new Error(`${input} not found`);
    let rel = relative(resolve(root), abs);
    // the designer's export is a pinned input: keep a copy in the repo
    if (rel.startsWith('..') || isAbsolute(rel)) {
      rel = join(paths.sourceDir, basename(abs));
      mkdirSync(join(root, paths.sourceDir), { recursive: true });
      copyFileSync(abs, join(root, rel));
    }
    src = { kind: 'html', html: rel.split('\\').join('/') };
    if (opts.components) {
      const c = parseFigmaUrl(opts.components);
      if (!c.fileKey) throw new Error('--components needs a Figma design file link (duplicate a Community kit first)');
      src.components = c;
    }
  } else throw new Error(`expected a Figma link or an .html file, got ${input}`);
  if (opts.license) src.license = opts.license;
  if (opts.workFile) {
    const w = parseFigmaUrl(opts.workFile);
    if (!w.fileKey) throw new Error('--work-file needs a Figma design file link');
    src.workFile = w;
  }
  if (src.kind !== 'html' && !src.fileKey && src.kind !== 'figma-community') throw new Error('no file key');
  return src;
}

/** the Figma file that holds the components (and is synced): source, its duplicate, or the HTML's components file */
export const libraryKey = (src) => src?.fileKey || src?.components?.fileKey || '';
/** where proposals and screens go */
export const workKey = (src) => src?.workFile?.fileKey || libraryKey(src);

export function describeSource(src, { withWorkFile = true } = {}) {
  if (!src) return 'not configured — run `npx ds-workflow source <Figma link | design-system.html>`';
  const node = src.nodeId ? `, starting at node ${src.nodeId}` : '';
  const work = withWorkFile && src.workFile ? `; proposals and screens go to Figma file \`${src.workFile.fileKey}\`` : '';
  switch (src.kind) {
    case 'figma-file':
      return `Figma file \`${src.fileKey}\`${node}${work}`;
    case 'figma-library':
      return `team library \`${src.fileKey}\` (published; use its components as instances from other files)${node}${work}`;
    case 'figma-community':
      return src.fileKey
        ? `Figma Community kit ${src.communityUrl}, duplicated as \`${src.fileKey}\`${src.license ? ` (licence: ${src.license})` : ''}${node}${work}`
        : `Figma Community kit ${src.communityUrl} — not duplicated yet`;
    case 'html':
      return `the designer's HTML export \`${src.html}\`${src.components ? `, components in Figma file \`${src.components.fileKey}\`` : ' (no Figma components file)'}${work}`;
    default:
      return `unknown source kind ${src.kind}`;
  }
}

/** what to do next, per kind — printed by `source` and `init` */
export function nextSteps(src) {
  const exportSteps = (key) => [
    `Sync through the Figma MCP (any agent, any plan): run docs/ds-workflow/figma/export-design-system.js with use_figma on file ${key} (playbooks/ds-adopt step 2), then`,
    `  npx ds-workflow sync --export 'design-system/source/figma-export.*.json' --label <designer's version label>`,
    `Or with a Figma token (variables need Enterprise; only published styles / components): FIGMA_TOKEN=… npx ds-workflow sync --figma`,
  ];
  switch (src?.kind) {
    case 'figma-file':
    case 'figma-library':
      return [
        ...exportSteps(src.fileKey),
        ...(src.nodeId ? [`The link points at node ${src.nodeId}: export components from the page that contains it (PART = 'pages' lists them).`] : []),
        ...(src.kind === 'figma-library' && !src.workFile ? ['A published library: written-back screens can live in another file and still use its components as instances. If you cannot edit the library, set a work file: npx ds-workflow source <link> --library --work-file <your file link>'] : []),
      ];
    case 'figma-community':
      if (!src.fileKey)
        return [
          '1. Check the kit\'s licence on its Community page (some kits limit where the design may be used).',
          '2. In Figma: open the Community page → "Open in Figma" (duplicates it into your drafts) → move the copy into your team project.',
          `3. npx ds-workflow source <link of your copy> --from-community ${src.communityUrl} --license "<licence name + URL>"`,
        ];
      return [
        ...exportSteps(src.fileKey),
        'Proposals and screens go into your copy (or a --work-file); the Community original is never edited. When the kit publishes a new version, duplicate it again, point `source` at the new copy and sync to a new label (ds-upgrade).',
      ];
    case 'html':
      return [
        `npx ds-workflow sync --label <designer's version label>   (reads ${src.html}; tokens only)`,
        src.components
          ? `Components: export them from Figma file ${src.components.fileKey} (export script, PART = 'components') and add --export 'design-system/source/figma-export.components.*.json' to the same sync.`
          : 'No Figma components file: components cannot be reused by node id, and screens cannot be written back as instances. Ask the designer for the library file and run: npx ds-workflow source <html> --components <Figma link>',
        'When the designer sends a new export, replace the file (same path) and sync to a new label.',
      ];
    default:
      return ['npx ds-workflow source <Figma link | design-system.html>'];
  }
}
