// 通用可嵌套树模型：复杂格式（JSON/YAML/XML/TOML）导入即无损保存为 DataNode，
// 导出原样还原（数组 / 嵌套 / 类型均保留）；仅 CSV/Excel 等平坦格式做有损投影。
import { valueToRecords, recordsToValue, type Records, type FlattenStrategy } from './records.ts'

export type Primitive = string | number | boolean | null

export interface DictNode {
  type: 'dict'
  value: Record<string, DataNode>
}
export interface ListNode {
  type: 'array'
  value: DataNode[]
}
export interface PrimNode {
  type: 'scalar'
  value: Primitive
}
export type DataNode = DictNode | ListNode | PrimNode

export function scalar(value: Primitive): PrimNode {
  return { type: 'scalar', value }
}
export function dict(value: Record<string, DataNode>): DictNode {
  return { type: 'dict', value }
}
export function list(value: DataNode[]): ListNode {
  return { type: 'array', value }
}

export function valueToNode(v: unknown): DataNode {
  if (v === null || v === undefined) return scalar(null)
  const t = typeof v
  if (t === 'string' || t === 'number' || t === 'boolean') return scalar(v as Primitive)
  if (Array.isArray(v)) return list(v.map(valueToNode))
  if (t === 'object') {
    const out: Record<string, DataNode> = {}
    for (const k of Object.keys(v as Record<string, unknown>)) {
      out[k] = valueToNode((v as Record<string, unknown>)[k])
    }
    return dict(out)
  }
  return scalar(String(v))
}

export function nodeToValue(n: DataNode): unknown {
  switch (n.type) {
    case 'scalar':
      return n.value
    case 'array':
      return n.value.map(nodeToValue)
    case 'dict': {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(n.value)) out[k] = nodeToValue(n.value[k])
      return out
    }
  }
}

// —— 树 ↔ 平坦投影(Records) 桥梁 ——
// flattenNode：树 → 平坦投影。仅平坦格式(CSV/Excel)导出/预览使用，是唯一的有损投影点。
export function flattenNode(node: DataNode, strategy: FlattenStrategy = 'flatten'): Records {
  return valueToRecords(nodeToValue(node), strategy)
}

// records → 树（CSV 等平坦源导入时：把二维表还原为对象数组树）
export function recordsToNode(records: Records): DataNode {
  return valueToNode(recordsToValue(records))
}