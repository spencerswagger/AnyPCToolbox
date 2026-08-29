import type { ApiRequest } from './model.ts'
import { replaceAll } from './variables.ts'

export type BuiltRequest = {
  method: string
  url: string
  headers: [string, string][]
  body?: string
}

export function buildRequest(api: ApiRequest, resolved: Record<string, string>, overrides: Record<string, string> = {}): BuiltRequest {
  let url = replaceAll(api.urlTemplate, resolved)
  const qmap = new Map<string, string>()
  for (const q of api.query) {
    if (q.enabled === false || q.key.trim() === '') continue
    qmap.set(q.key, encodeURIComponent(replaceAll(q.value, resolved)))
  }
  // 分页等运行时注入的参数：存在同名则覆盖，避免重复
  for (const [k, v] of Object.entries(overrides)) qmap.set(k, encodeURIComponent(v))
  const query = [...qmap].map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
  if (query.length) url += (url.includes('?') ? '&' : '?') + query.join('&')

  const headers = api.headers.filter((h) => h.enabled !== false && h.key.trim() !== '').map((h): [string, string] => [h.key, replaceAll(h.value, resolved)])
  const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type')

  let body: string | undefined
  if (api.bodyType === 'json' || api.bodyType === 'text') {
    body = replaceAll(api.bodyText, resolved)
    if (api.bodyType === 'json' && !hasContentType && (body ?? '').trim() !== '') {
      headers.push(['Content-Type', 'application/json'])
    }
  } else if (api.bodyType === 'form') {
    // 表单由条目化配置拼装为 application/x-www-form-urlencoded
    const pairs = api.form.filter((f) => f.enabled !== false && f.key.trim() !== '')
      .map((f) => `${encodeURIComponent(replaceAll(f.key, resolved))}=${encodeURIComponent(replaceAll(f.value, resolved))}`)
    if (pairs.length) {
      body = pairs.join('&')
      if (!hasContentType) headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
    }
  }

  return { method: api.method, url, headers, body: body || undefined }
}