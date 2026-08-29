import { JSONPath } from 'jsonpath-plus'
import type { ParseConfig } from './model.ts'

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
  const arr = JSONPath({ path: path.trim(), json }) as unknown[]
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