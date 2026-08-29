import { JSONPath } from 'jsonpath-plus'
import type { ColumnDef, ColumnType, ParseConfig, PagingConfig } from './model.ts'

export interface ParseResult {
  ok: boolean
  json: unknown | null
  raw: string
  rows: unknown[]
  total?: number
  page?: number
  topKeys?: string[]
  error?: string
}

function pick(path: string, json: unknown): unknown {
  if (!path || path.trim() === '') return undefined
  // jsonpath-plus 类型声明的 json 参数仅接受可 JSON 序列化值；JSON.parse 结果在此已收窄为实际 JSON 结构
  const arr = JSONPath({ path: path.trim(), json: json as any }) as unknown[]
  return arr && arr.length ? arr[0] : undefined
}

function asNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function parseResponse(raw: string, cfg: ParseConfig): ParseResult {
  let json: unknown = null
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, json: null, raw, rows: [], error: '响应不是合法 JSON' }
  }
  const topKeys = Array.isArray(json) ? [] : typeof json === 'object' && json !== null ? Object.keys(json as Record<string, unknown>) : undefined
  const rowsRaw = pick(cfg.listPath, json)
  const rows = Array.isArray(rowsRaw) ? rowsRaw : []
  const total = cfg.totalPath ? asNum(pick(cfg.totalPath, json)) : undefined
  const page = cfg.pagePath ? asNum(pick(cfg.pagePath, json)) : undefined
  const ok = rows.length > 0
  return { ok, json, raw, rows, total, page, topKeys, error: ok ? undefined : '未匹配到列表数据，检查 listPath' }
}

// ==================== 常见 JSON 返回格式推断 ====================

export interface InferResult {
  parse: { listPath?: string; totalPath?: string; pagePath?: string; columns: ColumnDef[] }
  paging: Partial<PagingConfig>
  summary: string
}

const CONTAINER_KEYS = ['data', 'result', 'response', 'body', 'payload', 'res']
const LIST_KEYS = ['list', 'records', 'items', 'rows', 'content', 'elements', 'data', 'listData', 'result']
// 优先命中的列表键（若同层出现 data / list / records 并存，取这些命中）
const TOTAL_KEYS = ['total', 'totalCount', 'total_count', 'totalItems', 'total_items', 'totalElements', 'recordsTotal', 'recordsFiltered', 'count', 'size']
const PAGE_KEYS = ['page', 'pageNum', 'pageNumber', 'current', 'currentPage', 'pageNo', 'number', 'offset']

function guessType(v: unknown): ColumnType {
  if (typeof v === 'boolean') return 'bool'
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') {
    if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?\S*)?$/i.test(v)) return 'image'
    if (v.startsWith('http://') || v.startsWith('https://')) return 'link'
    if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(v)) return 'datetime'
  }
  if (v !== null && typeof v === 'object') {
    if (Array.isArray(v)) {
      // 数组首元素是对象才算「数组<对象>」列；否则仍当作 text
      const first = v[0]
      return first !== null && typeof first === 'object' && !Array.isArray(first) ? 'array' : 'text'
    }
    return 'object'
  }
  return 'text'
}

function inferColumns(row: unknown): ColumnDef[] {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return []
  return Object.entries(row as Record<string, unknown>).map(([k, v]) => ({ field: k, title: '', type: guessType(v) }))
}

// 取某个 JSONPath 在 json 中命中的值（供「设为列表」等运行时下钻使用）
export function evalPath(json: unknown, path: string): unknown {
  return pick(path, json)
}
// 根据列表数组重新推断字段列（对象字段为 object，对象数组为 array，保证「查看」列类型一致）
export function columnsForList(list: unknown): ColumnDef[] {
  return Array.isArray(list) && list.length ? inferColumns(list[0]) : []
}

function findArrayAfterScan(root: Record<string, unknown>): { listPath: string; listOwner: Record<string, unknown>; list: unknown[] } | null {
  const scan = (obj: Record<string, unknown>, base: string): { path: string; arr: unknown[] }[] => {
    const hits: { path: string; arr: unknown[] }[] = []
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) hits.push({ path: base ? `${base}.${k}` : k, arr: v })
    }
    return hits
  }
  const hits = scan(root, '')
  for (const ck of CONTAINER_KEYS) {
    const c = root[ck]
    if (c && typeof c === 'object' && !Array.isArray(c)) hits.push(...scan(c as Record<string, unknown>, ck))
  }
  if (!hits.length) return null
  const rank = (p: string) => {
    const last = p.split('.').pop() || ''
    return LIST_KEYS.includes(last) ? 0 : 1
  }
  hits.sort((a, b) => rank(a.path) - rank(b.path))
  const hit = hits[0]
  let listOwner: Record<string, unknown> = root
  // 定位数组的直接宿主对象（同级可找 total / page）
  const parts = hit.path.split('.')
  if (parts.length > 1) {
    let cur: unknown = root
    for (const p of parts.slice(0, -1)) cur = (cur as Record<string, unknown>)?.[p]
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) listOwner = cur as Record<string, unknown>
  }
  return { listPath: hit.path, listOwner, list: hit.arr }
}

function firstPath(owner: Record<string, unknown>, root: Record<string, unknown>, names: string[], ownerPrefix: string): string | undefined {
  for (const n of names) {
    if (owner[n] !== undefined && owner[n] !== null) return ownerPrefix ? `$.${ownerPrefix}.${n}` : `$.${n}`
  }
  for (const n of names) {
    if (root[n] !== undefined && root[n] !== null) return `$.${n}`
  }
  return undefined
}

export function inferParse(json: unknown): InferResult | null {
  if (Array.isArray(json)) {
    return {
      parse: { listPath: '$', columns: inferColumns(json[0]) },
      paging: { enabled: true, mode: 'page', pageParam: 'page', sizeParam: 'pageSize' },
      summary: '顶层即数组，可直接作为列表表格展示',
    }
  }
  if (typeof json !== 'object' || json === null) return null
  const root = json as Record<string, unknown>
  const found = findArrayAfterScan(root)
  if (!found) return null
  const ownerPrefix = found.listPath.split('.').slice(0, -1).join('.')
  const totalPath = firstPath(found.listOwner, root, TOTAL_KEYS, ownerPrefix)
  const pageField = firstPath(found.listOwner, root, PAGE_KEYS, ownerPrefix)
  // 根据页码字段名推断分页风格
  const name = pageField?.split('.').pop()
  let paging: Partial<PagingConfig>
  if (name === 'offset') paging = { enabled: true, mode: 'offset', pageParam: 'page', sizeParam: 'limit', offsetParam: 'offset' }
  else if (name === 'pageNumber' || name === 'pageNum') paging = { enabled: true, mode: 'page', pageParam: 'pageNumber', sizeParam: 'pageSize' }
  else if (name === 'current') paging = { enabled: true, mode: 'page', pageParam: 'current', sizeParam: 'size' }
  else paging = { enabled: true, mode: 'page', pageParam: 'page', sizeParam: 'pageSize' }
  return {
    parse: { listPath: `$.${found.listPath}`, totalPath, pagePath: pageField, columns: inferColumns(found.list[0]) },
    paging,
    summary: `识别到列表位于 $.${found.listPath}，共 ${found.list.length} 条字段列${totalPath ? '，并找到总数与页码字段' : ''}`,
  }
}