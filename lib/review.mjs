// The review ledger (config review.ledger, playbooks/ds-review-loop): what the designer has marked Ready for dev, what
// is not confirmed either way, and what is waiting for review. It lives in the repo because the Figma API cannot read
// the Ready-for-dev mark, and because every agent and person working on the project must see the same state — an
// agent's private memory or chat history is not shared.
//
//   ready        [{ section, nodeId, frames?, since, codeAligned? }]   the designer's: never overwritten (v2 beside it)
//   unconfirmed  [{ section, nodeId, frames?, note? }]                 made or edited by the designer, status unknown:
//                                                                     treated like ready
//   pending      [{ added, what, code?, nodes: { screens?, components? } }]  waiting for the designer
//   reviewQueue  { page, nodeId, url? } | null                         the board in Figma that lists `pending`
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './util.mjs';

const NODE = /^\d+[:-]\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (id) => String(id).replace('-', ':');
/** frames may be names ("1.03") or { name, nodeId } */
const frameIds = (s) => (s.frames ?? []).filter((f) => f && typeof f === 'object' && f.nodeId).map((f) => norm(f.nodeId));

export function readLedger(cfg, root = cfg.root ?? '.') {
  const f = join(root, cfg.review.ledger);
  return existsSync(f) ? readJson(f) : null;
}

export function checkLedger(cfg, root = cfg.root ?? '.') {
  const l = readLedger(cfg, root);
  if (!l) return [];
  const where = cfg.review.ledger;
  const errors = [];
  const protectedIds = new Map(); // nodeId → why it may not be changed in place
  for (const key of ['ready', 'unconfirmed']) {
    if (l[key] !== undefined && !Array.isArray(l[key])) errors.push(`${where}: ${key} must be a list`);
    for (const s of l[key] ?? []) {
      if (!s.section) errors.push(`${where}: a ${key} entry has no section name`);
      if (!NODE.test(String(s.nodeId ?? ''))) errors.push(`${where}: ${key} "${s.section}" needs the section's nodeId (e.g. 12:345)`);
      if (key === 'ready' && !DATE.test(s.since ?? '')) errors.push(`${where}: ready "${s.section}" needs since (YYYY-MM-DD)`);
      for (const id of [norm(s.nodeId), ...frameIds(s)]) {
        if (protectedIds.has(id)) errors.push(`${where}: ${id} is listed twice (${protectedIds.get(id)} and ${key} "${s.section}")`);
        protectedIds.set(id, `${key} "${s.section}"`);
      }
    }
  }
  if (l.pending !== undefined && !Array.isArray(l.pending)) errors.push(`${where}: pending must be a list`);
  for (const [i, r] of (l.pending ?? []).entries()) {
    const name = `pending[${i}]${r.what ? ` "${r.what}"` : ''}`;
    if (!DATE.test(r.added ?? '')) errors.push(`${where}: ${name} needs added (YYYY-MM-DD)`);
    const ids = [...(r.nodes?.screens ?? []), ...(r.nodes?.components ?? [])];
    if (!ids.length) errors.push(`${where}: ${name} lists no nodes (nodes.screens / nodes.components)`);
    for (const id of ids) {
      if (!NODE.test(String(id))) errors.push(`${where}: ${name}: "${id}" is not a node id`);
      // a change waiting for review must be a new node (a v2 beside the designer's), never the designer's own node
      else if (protectedIds.has(norm(id))) errors.push(`${where}: ${name} changes ${id}, which is ${protectedIds.get(norm(id))}: put the change in a v2 beside it`);
    }
  }
  if (l.reviewQueue && !NODE.test(String(l.reviewQueue.nodeId ?? ''))) errors.push(`${where}: reviewQueue needs the board's nodeId`);
  return errors;
}

export function reviewSummary(cfg, root = cfg.root ?? '.') {
  const l = readLedger(cfg, root);
  if (!l) return { text: `${cfg.review.ledger} not found (run \`npx ds-workflow init\`)`, pending: 0 };
  const lines = [`${cfg.review.ledger}`];
  lines.push(`  ready for dev (${(l.ready ?? []).length}): ${(l.ready ?? []).map((s) => `${s.section}${s.codeAligned ? '' : ' (code not aligned yet)'}`).join(' · ') || '—'}`);
  lines.push(`  unconfirmed (${(l.unconfirmed ?? []).length}): ${(l.unconfirmed ?? []).map((s) => s.section).join(' · ') || '—'}`);
  lines.push(`  waiting for review (${(l.pending ?? []).length}):`);
  for (const r of l.pending ?? []) lines.push(`    ${r.added}  ${r.what ?? ''}${r.code?.length ? `  [${r.code.join(' ')}]` : ''}  ${[...(r.nodes?.screens ?? []), ...(r.nodes?.components ?? [])].join(', ')}`);
  return { text: lines.join('\n'), pending: (l.pending ?? []).length };
}
