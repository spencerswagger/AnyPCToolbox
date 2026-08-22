import { stringify } from 'yaml'
import type { DataNode } from '../node.ts'
import { nodeToValue } from '../node.ts'

export function nodeToYaml(node: DataNode): string {
  return stringify(nodeToValue(node))
}