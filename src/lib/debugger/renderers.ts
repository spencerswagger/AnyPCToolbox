import type { ColumnDef } from './model.ts'

export interface CellView {
  kind: 'text' | 'image' | 'link'
  text: string
}

export function enumLabel(v: unknown, map?: Record<string, string>): string {
  const key = v === null || v === undefined ? '' : String(v)
  return map && key in map ? map[key] : key
}

function formatDatetime(v: unknown): string {
  if (v === null || v === undefined) return ''
  const n = Number(v)
  if (Number.isFinite(n)) {
    const ms = Math.abs(n) > 1e12 ? n : n * 1000 // 毫秒级 vs 秒级
    return new Date(ms).toLocaleString()
  }
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

export function toCellView(value: unknown, col: ColumnDef): CellView {
  const raw = value === null || value === undefined ? '' : value
  switch (col.type) {
    case 'image': {
      const s = String(raw)
      return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?\S*)?$/i.test(s)
        ? { kind: 'image', text: s }
        : { kind: 'text', text: s }
    }
    case 'link':
      return /^https?:\/\/\S+$/i.test(String(raw)) ? { kind: 'link', text: String(raw) } : { kind: 'text', text: String(raw) }
    case 'enum':
      return { kind: 'text', text: enumLabel(raw, col.enumMap) }
    case 'bool':
      return { kind: 'text', text: raw === true || raw === 1 || raw === '1' || raw === 'true' ? '是' : '否' }
    case 'datetime':
      return { kind: 'text', text: formatDatetime(raw) }
    case 'number':
      return { kind: 'text', text: typeof raw === 'number' ? String(raw) : String(raw) }
    default:
      return { kind: 'text', text: String(raw) }
  }
}