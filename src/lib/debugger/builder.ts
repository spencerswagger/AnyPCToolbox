import type { ApiRequest } from './model.ts'
import { replaceAll } from './variables.ts'

export type BuiltRequest = {
  method: string
  url: string
  headers: [string, string][]
  body?: string
}

export function buildRequest(api: ApiRequest, resolved: Record<string, string>): BuiltRequest {
  let url = replaceAll(api.urlTemplate, resolved)
  const query = api.query
    .filter((q) => q.key.trim() !== '')
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(replaceAll(q.value, resolved))}`)
  if (query.length) url += (url.includes('?') ? '&' : '?') + query.join('&')

  const headers = api.headers.filter((h) => h.key.trim() !== '').map((h): [string, string] => [h.key, replaceAll(h.value, resolved)])
  const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type')

  let body: string | undefined
  if (api.bodyType === 'json' || api.bodyType === 'text') {
    body = replaceAll(api.bodyText, resolved)
    if (api.bodyType === 'json' && !hasContentType && (body ?? '').trim() !== '') {
      headers.push(['Content-Type', 'application/json'])
    }
  } else if (api.bodyType === 'form') {
    body = replaceAll(api.bodyText, resolved)
    if ((body ?? '').trim() !== '' && !hasContentType) headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
  }

  return { method: api.method, url, headers, body: body || undefined }
}