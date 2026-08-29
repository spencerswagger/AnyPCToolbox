export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyType = 'none' | 'json' | 'form' | 'text'
export type ColumnType = 'text' | 'number' | 'bool' | 'enum' | 'image' | 'datetime' | 'link' | 'object' | 'array'

export interface KvItem {
  key: string
  value: string
  enabled?: boolean // 勾选后才参与请求；默认 true
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

export type PagingMode = 'page' | 'offset'
export interface PagingConfig {
  enabled: boolean
  mode: PagingMode // page：页码+每页条数；offset：limit+offset 游标分页
  pageParam: string // 页码参数名，如 page / pageNumber / current
  sizeParam: string // 每页条数参数名，如 pageSize / size / per_page / limit
  offsetParam: string // 偏移参数名（offset 模式），如 offset / start / skip
  size: number // 每页条数
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
  bodyText: string // 可含 {{var}}；json / text 时作为请求体原文
  form: KvItem[] // form 类型时的表单条目（key=value）
  variables: VariableDef[]
  parse: ParseConfig
  paging: PagingConfig
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
    form: partial.form ?? [],
    variables: partial.variables ?? [],
    parse: { listPath: '', columns: [], ...partial.parse },
    paging: { enabled: false, mode: 'page', pageParam: 'page', sizeParam: 'pageSize', offsetParam: 'offset', size: 10, ...partial.paging },
    updatedAt: partial.updatedAt ?? Date.now(),
  }
}