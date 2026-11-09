// design-system.config.json — the only project-specific input. Everything else (paths, names, gates) follows from it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILE = 'design-system.config.json';

export const DEFAULTS = {
  designSystem: {
    /** shown in generated files and docs */
    name: 'Design System',
    /**
     * where the design system comes from — set it with `npx ds-workflow source <link | file.html>` (lib/source.mjs):
     * { kind: figma-file | figma-library | figma-community | html, url, fileKey, nodeId?, communityUrl?, license?,
     *   html?, components?: { fileKey, url }, workFile?: { fileKey, url } }
     */
    source: null,
    /** derived from source (the Figma file that is synced); a 0.1 config may set only this */
    figmaFileKey: '',
    /** page in that file where this project proposes new components / variants / variables */
    proposalPage: 'Proposed',
    /** page where this project writes its screens back as component instances; {label} = pinned version */
    screensPage: 'Screens · {label}',
  },
  proposal: {
    /** Figma name prefix of proposed components: "Proposed" → Proposed/<Area>/<Name>; code id proposed/<Area>/<Name> */
    prefix: 'Proposed',
  },
  tokens: {
    /** CSS custom property prefix: "ds" → --ds-color-brand-6 */
    prefix: 'ds',
    /** generated CSS (never edited by hand) */
    css: 'src/styles/ds-tokens.css',
    /** hand-written proposals pending the designer's approval (DTCG) */
    proposed: 'design-system/tokens/proposed.tokens.json',
  },
  check: {
    /** directories scanned by the gate */
    scan: ['src'],
    extensions: ['.css', '.scss', '.less', '.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'],
    /** the component library: tokens only — no px literals, no non-token custom properties */
    componentDirs: ['src/ui'],
    ignore: ['**/*.test.*', '**/*.spec.*', '**/*.stories.*'],
    /** legacy token layers (old names aliasing the new tokens): literal values there may only go down */
    legacy: [],
    baseline: 'design-system/check-baseline.json',
  },
  registry: {
    markdown: 'docs/design/component-registry.md',
  },
  playbooks: {
    /** where `init` / `rules` copy the playbooks so every agent can read them in the repo */
    dir: 'docs/ds-workflow',
  },
  agents: {
    /**
     * which coding agents get the rules (lib/rules.mjs AGENT_TARGETS). "auto": AGENTS.md, plus every agent whose own
     * file or folder already exists in the repo. Or a list, e.g. ["agents-md", "cursor", "copilot"].
     */
    targets: 'auto',
    /** folders where an agent loads skills in the SKILL.md format; each gets a copy of the playbooks */
    skillsDirs: [],
    /** any other instruction file an agent reads: gets the same managed block as AGENTS.md */
    extraFiles: [],
  },
  review: {
    /** where the designer is reminded of screens to review: "figma" (they work only in Figma), "issue", or "both" */
    channel: 'figma',
    /** the review ledger: Ready-for-dev sections, unconfirmed sections, pending reviews (playbooks/ds-review-loop) */
    ledger: 'design-system/figma-review.json',
    /** the designer puts this before a section name when marking it Ready for dev (the API cannot read the mark) */
    readyMarker: '✅ Ready',
    /** added after the name of a frame or component waiting for review */
    pendingMarker: '· 🟡 In review',
    /** Figma annotation category for changed layers */
    annotationCategory: 'Design review',
    /** the board on the screens page that lists everything waiting for review */
    queueName: 'Review queue',
  },
};

const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b ?? a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return out;
};

export function loadConfig(root = '.') {
  const f = join(root, CONFIG_FILE);
  const user = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  const cfg = merge(DEFAULTS, user);
  const ds = cfg.designSystem;
  // 0.1 configs name only the file key
  if (!ds.source && ds.figmaFileKey) ds.source = { kind: 'figma-file', fileKey: ds.figmaFileKey, url: `https://www.figma.com/design/${ds.figmaFileKey}` };
  ds.figmaFileKey = ds.source?.fileKey || ds.source?.components?.fileKey || ds.figmaFileKey || '';
  cfg.root = root;
  cfg.found = existsSync(f);
  return cfg;
}

/** fixed layout of design-system/ (documented in templates/design-system/README.md) */
export const paths = {
  dir: 'design-system',
  lock: 'design-system/lock.json',
  tokens: 'design-system/tokens/design-system.tokens.json',
  names: 'design-system/tokens/names.json',
  inventory: 'design-system/components.inventory.json',
  registry: 'design-system/components.registry.json',
  migrations: 'design-system/migrations',
  sourceDir: 'design-system/source',
};

export const proposalCode = (cfg) => cfg.proposal.prefix.toLowerCase();
