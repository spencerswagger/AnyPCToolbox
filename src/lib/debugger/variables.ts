import type { ApiRequest } from './model.ts'

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

/** 提取字符串中所有占位符名（去重、保序） */
export function extractPlaceholders(sources: string[]): string[] {
  const set = new Map<string, true>()
  for (const s of sources) {
    for (const m of s.matchAll(PLACEHOLDER)) {
      if (!set.has(m[1])) set.set(m[1], true)
    }
  }
  return [...set.keys()]
}

/** 收集一个接口所有可能含占位符的文本片段（用于提取） */
export function collectSnippet(api: Pick<ApiRequest, 'urlTemplate' | 'query' | 'headers' | 'bodyText'>): string {
  return [
    api.urlTemplate,
    ...api.query.map((q) => q.value),
    ...api.headers.map((h) => h.value),
    api.bodyText,
  ].join('\n')
}

/** 解析最终的变量字典：模板变量值优先，未设置(空)回退全局 */
export function resolveVars(vars: { name: string; value: string }[], globals: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of vars) {
    out[v.name] = v.value || globals[v.name] || ''
  }
  Object.keys(globals).forEach((k) => { if (out[k] === undefined) out[k] = globals[k] ?? '' })
  return out
}

/** 替换模板中的 {{name}}；未命中的占位符原样保留 */
export function replaceAll(template: string, resolved: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_m, name: string) =>
    name in resolved ? resolved[name] : _m,
  )
}