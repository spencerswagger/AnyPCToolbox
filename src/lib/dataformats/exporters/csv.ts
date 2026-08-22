import type { Cell, Records } from '../records.ts'

function csvField(v: Cell): string {
  if (v === null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function recordsToCsv(records: Records): string {
  const head = records.columns.map(csvField).join(',')
  const lines = records.rows.map((r) => r.map(csvField).join(','))
  return `\uFEFF${[head, ...lines].join('\r\n')}`
}