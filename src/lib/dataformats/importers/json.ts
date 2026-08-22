import type { DataNode } from '../node.ts'
import { valueToNode } from '../node.ts'
import { FormatError } from '../records.ts'

export function jsonToNode(text: string): DataNode {
  if (!text.trim()) return { type: 'array', value: [] }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    throw new FormatError(`JSON 解析失败：${(e as Error).message}`)
  }
  return valueToNode(value)
}