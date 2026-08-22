export type Cell = string | number | boolean | null
export interface Records {
  columns: string[]
  rows: Cell[][]
}

export type FlattenStrategy = 'flatten' | 'firstLevel'
export const FLATTEN_DEPTH = 5

export class FormatError extends Error {
  line?: number
  col?: number
  constructor(message: string, line?: number, col?: number) {
    super(message)
    this.name = 'FormatError'
    this.line = line
    this.col = col
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function headerDedup(columns: string[]): string[] {
  const seen = new Map<string, number>()
  return columns.map((c) => {
    const name = c === '' ? 'column' : c
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    return n === 0 ? name : `${name}_${n}`
  })
}

export function buildRecords(columns: string[], rows: Cell[][]): Records {
  const cols = headerDedup(columns)
  const width = cols.length
  const padded = rows.map((r) => {
    const row = [...r]
    while (row.length < width) row.push(null)
    return row.slice(0, width)
  })
  return { columns: cols, rows: padded }
}

function cellOf(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return JSON.stringify(v)
}

function objectToRow(obj: unknown, prefix: string, strategy: FlattenStrategy, depth: number): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  const path = (key: string) => (prefix ? `${prefix}.${key}` : key)
  if (Array.isArray(obj)) {
    out[prefix || 'data'] = JSON.stringify(obj)
    return out
  }
  const o = obj as Record<string, unknown>
  for (const key of Object.keys(o)) {
    const p = path(key)
    const v = o[key]
    if (isPlainObject(v)) {
      if (strategy === 'firstLevel' || depth >= FLATTEN_DEPTH) {
        out[p] = JSON.stringify(v)
      } else {
        Object.assign(out, objectToRow(v, p, strategy, depth + 1))
      }
    } else if (Array.isArray(v)) {
      out[p] = JSON.stringify(v)
    } else {
      out[p] = cellOf(v)
    }
  }
  return out
}

export function valueToRecords(value: unknown, strategy: FlattenStrategy = 'flatten'): Records {
  if (value === null || value === undefined) return { columns: [], rows: [] }
  if (Array.isArray(value)) {
    const rowMaps = value.map((el) => objectToRow(el, '', strategy, 0))
    const columns = headerDedup([...new Set(rowMaps.flatMap(Object.keys))])
    const rows = rowMaps.map((m) => columns.map((c) => m[c] ?? null))
    return { columns, rows }
  }
  if (isPlainObject(value)) {
    const m = objectToRow(value, '', strategy, 0)
    return buildRecords(Object.keys(m), [Object.values(m)])
  }
  return { columns: ['data'], rows: [[cellOf(value)]] }
}

function setPath(obj: Record<string, unknown>, path: string, v: unknown): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (!isPlainObject(cur[k])) cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = v
}

export function recordsToValue(records: Records): unknown {
  return records.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    records.columns.forEach((c, i) => setPath(obj, c, row[i]))
    return obj
  })
}