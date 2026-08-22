import type { DataNode } from '../node.ts'
import { nodeToValue } from '../node.ts'

export function nodeToJson(node: DataNode): string {
  return JSON.stringify(nodeToValue(node), null, 2)
}