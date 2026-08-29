export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyType = 'none' | 'json' | 'form' | 'text'
export type ColumnType = 'text' | 'number' | 'bool' | 'enum' | 'image' | 'datetime' | 'link'

export interface KvItem {
  key: string
  value: string
}

export interface VariableDef {
  name: string
  value: string
  desc?: string
}

export interface ColumnDef {
  field: string
  title: string
  type: ColumnType
  enumMap?: Record<string, string> // 如 { '1': '男', '2': '女' }
  width?: number
}

export interface ParseConfig {
  listPath: string
  totalPath?: string
  pagePath?: string
  columns: ColumnDef[]
}

export interface ApiRequest {
  id: string
  protocol: 'http' // 预留 'ws' | 'graphql'
  name: string
  method: HttpMethod
  urlTemplate: string // 可含 {{var}}
  query: KvItem[]
  headers: KvItem[]
  bodyType: BodyType
  bodyText: string // 可含 {{var}}
  variables: VariableDef[]
  parse: ParseConfig
  updatedAt: number
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function createApiRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: partial.id ?? (crypto.randomUUID ? crypto.randomUUID() : `a${Date.now()}${Math.random().toString(16).slice(2)}`),
    protocol: 'http',
    name: partial.name ?? '新接口',
    method: METHODS.includes(partial.method as HttpMethod) ? (partial.method as HttpMethod) : 'GET',
    urlTemplate: partial.urlTemplate ?? 'https://example.com/',
    query: partial.query ?? [],
    headers: partial.headers ?? [],
    bodyType: partial.bodyType ?? 'none',
    bodyText: partial.bodyText ?? '',
    variables: partial.variables ?? [],
    parse: { listPath: '', columns: [], ...partial.parse },
    updatedAt: partial.updatedAt ?? Date.now(),
  }
}