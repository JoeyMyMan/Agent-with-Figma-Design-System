// Shared helpers. No dependencies: every project and every agent can run the CLI with plain Node ≥ 20.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Figma path parts → css-safe name: "Body/S/regular" → "body-s-regular" */
export const slug = (parts) =>
  (Array.isArray(parts) ? parts : [parts])
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const pathOf = (name) => String(name).split('/').map((s) => s.trim()).filter(Boolean);

export const isToken = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && '$type' in o;

/** depth-first list of [pathParts, token] in a DTCG tree (keys starting with $ are metadata) */
export function walkTokens(tree, path = [], out = []) {
  for (const [k, v] of Object.entries(tree ?? {})) {
    if (k.startsWith('$')) continue;
    if (isToken(v)) out.push([[...path, k], v]);
    else if (v && typeof v === 'object' && !Array.isArray(v)) walkTokens(v, [...path, k], out);
  }
  return out;
}

/** put a token at "a/b/c" in a DTCG tree */
export function putToken(tree, path, token) {
  let node = tree;
  for (const p of path.slice(0, -1)) {
    // Figma allows a style "a/b" next to a group "a/b/…": the group goes under "b group"
    const key = isToken(node[p]) ? `${p} group` : p;
    node = node[key] ??= {};
  }
  const last = path.at(-1);
  node[node[last] && !isToken(node[last]) ? `${last} token` : last] = token;
}

export const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);

export function writeText(f, text) {
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, text);
}
export const writeJson = (f, data, indent = 2) => writeText(f, JSON.stringify(data, null, indent) + '\n');

/** every file under `dirs` (relative to root) with one of `extensions`, as posix paths relative to root */
export function listFiles(root, dirs, extensions, ignore = []) {
  const out = [];
  const res = ignore.map((p) => (p instanceof RegExp ? p : globToRegExp(p)));
  const visit = (abs) => {
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs)) {
      if (name === 'node_modules' || name.startsWith('.git')) continue;
      const p = join(abs, name);
      const st = statSync(p);
      const rel = relative(root, p).split(sep).join('/');
      if (st.isDirectory()) visit(p);
      else if (extensions.some((e) => name.endsWith(e)) && !res.some((r) => r.test(rel))) out.push(rel);
    }
  };
  for (const d of dirs) visit(join(root, d));
  return out.sort();
}

/** minimal glob: ** any path, * any name part, ? one char */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const stripComments = (s, css) =>
  css ? s.replace(/\/\*[\s\S]*?\*\//g, '') : s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const today = () => new Date().toISOString().slice(0, 10);

export const rgba = ({ r, g, b, a = 1 }, opacity = 1) =>
  `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+(a * opacity).toFixed(3)})`;
