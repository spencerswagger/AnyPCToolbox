import type { DataNode } from '../node.ts'
import { flattenNode } from '../node.ts'
import type { Records, Cell } from '../records.ts'

function csvField(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function recordsToCsv(records: Records): string {
  const head = records.columns.map(csvField).join(',')
  const lines = records.rows.map((r) => r.map(csvField).join(','))
  return `\uFEFF${[head, ...lines].join('\r\n')}`
}

// CSV 导出：使用已编辑的平坦投影（列顺序/隐藏后的 Records）。
// projection 由视图层在当前策略下扁平化 DataNode 并应用列编辑得到；未提供时兜底自身扁平化。
export function nodeToCsv(node: DataNode, projection?: Records): string {
  return recordsToCsv(projection ?? flattenNode(node))
}