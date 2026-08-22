import { parse } from 'yaml'
import type { DataNode } from '../node.ts'
import { valueToNode } from '../node.ts'
import { FormatError } from '../records.ts'

export function yamlToNode(text: string): DataNode {
  let value: unknown
  try {
    value = parse(text)
  } catch (e) {
    throw new FormatError(`YAML 解析失败：${(e as Error).message}`)
  }
  if (value === null || value === undefined) return { type: 'array', value: [] }
  return valueToNode(value)
}