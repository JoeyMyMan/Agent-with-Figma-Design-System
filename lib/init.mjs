// `ds-workflow init`: lay down the config, the design-system/ skeleton, CI and the agent rules. Never overwrites an
// existing file (lists what it skipped); --force overwrites the templates (not your registry or tokens).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, loadConfig, paths } from './config.mjs';
import { PKG, writeRules } from './rules.mjs';
import { resolveSource, workKey } from './source.mjs';
import { writeJson, writeText } from './util.mjs';

export function init(root, opts = {}) {
  const created = [];
  const skipped = [];
  const put = (rel, text, { force = false } = {}) => {
    const f = join(root, rel);
    if (existsSync(f) && !force) return skipped.push(rel);
    writeText(f, text);
    created.push(rel);
  };
  const tpl = (rel) => readFileSync(join(PKG, 'templates', rel), 'utf8');

  // config
  const cfgText = JSON.parse(tpl('design-system.config.json'));
  if (opts.name) cfgText.designSystem.name = opts.name;
  if (opts.source) cfgText.designSystem.source = resolveSource(opts.source, { ...opts.sourceOpts, root });
  else if (opts.fileKey) cfgText.designSystem.source = resolveSource(`https://www.figma.com/design/${opts.fileKey}/`, { root });
  if (opts.prefix) cfgText.tokens.prefix = opts.prefix;
  if (opts.proposalPrefix) cfgText.proposal.prefix = opts.proposalPrefix;
  if (opts.agents) cfgText.agents = { ...cfgText.agents, targets: opts.agents.split(',').map((s) => s.trim()).filter(Boolean) };
  if (opts.skillsDirs?.length) cfgText.agents = { ...cfgText.agents, skillsDirs: opts.skillsDirs };
  if (opts.reviewChannel) cfgText.review = { ...cfgText.review, channel: opts.reviewChannel };
  if (opts.prefix && cfgText.tokens.css === 'src/styles/ds-tokens.css') cfgText.tokens.css = `src/styles/${opts.prefix}-tokens.css`;
  put(CONFIG_FILE, JSON.stringify(cfgText, null, 2) + '\n', { force: opts.force });

  const cfg = loadConfig(root);
  put(`${paths.dir}/README.md`, tpl('design-system/README.md'), { force: opts.force });
  put(paths.registry, tpl('design-system/components.registry.json'));
  put(cfg.tokens.proposed, tpl('design-system/proposed.tokens.json'));
  put(cfg.review.ledger, tpl('design-system/figma-review.json').replace('"file": ""', `"file": ${JSON.stringify(workKey(cfg.designSystem.source))}`));
  put(`${paths.migrations}/legacy-tokens.md`, '# Token gaps\n\nValues in the legacy styles that have no token yet (ds-adopt step 4, ds-map step 5). One row each: value · where it is used · suggested semantic name · proposal (Figma link or issue).\n\n| Value | Used in | Suggested name | Proposal |\n| --- | --- | --- | --- |\n');
  put(`${paths.sourceDir}/.gitkeep`, '');
  put('.github/workflows/ds-check.yml', tpl('github/ds-check.yml'), { force: opts.force });
  put('docs/design/handoff-design-system.md', tpl('handoff-section.md'), { force: opts.force });

  // npm scripts
  const pkgFile = join(root, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
    pkg.scripts ??= {};
    const add = { 'ds:check': 'ds-workflow check', 'ds:build': 'ds-workflow build', 'ds:registry': 'ds-workflow registry', 'ds:rules': 'ds-workflow rules' };
    let changed = false;
    for (const [k, v] of Object.entries(add)) if (!pkg.scripts[k]) ((pkg.scripts[k] = v), (changed = true));
    if (changed) {
      writeJson(pkgFile, pkg);
      created.push('package.json (scripts ds:*)');
    }
  }

  const rules = writeRules(cfg, { root });
  return { created: [...created, ...rules], skipped };
}
