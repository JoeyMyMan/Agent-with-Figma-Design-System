import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const name = 'figma-design-system'
export const inject = ['skills']

const providerName = 'dsh-figma-design-system'
const directory = fileURLToPath(new URL('.', import.meta.url))
const skillPath = fileURLToPath(new URL('./DSH.md', import.meta.url))
const candidate = {
  name: 'figma-design-system',
  description: '在 DeepSeek Harness 中接入 Figma 设计系统，锁定设计令牌，复用组件，检查样式和评审状态，或把页面回写成 Figma 组件实例。',
  invocation: { modelInvocable: true, userInvocable: true },
  provider: providerName,
  source: 'bundled',
  rank: 600,
  resourceBase: { kind: 'directory', path: directory },
  locator: { path: skillPath, directory },
}

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: providerName,
    async list() {
      return [candidate]
    },
    async get(request) {
      if (request.name !== candidate.name) return undefined
      const { name, description, invocation, provider, source, resourceBase } = candidate
      return {
        name,
        description,
        invocation,
        provider,
        source,
        resourceBase,
        content: await readFile(skillPath, 'utf8'),
      }
    },
  }))
}
