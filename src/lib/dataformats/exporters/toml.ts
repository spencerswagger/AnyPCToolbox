import { stringify } from 'smol-toml'
import type { DataNode } from '../node.ts'
import { nodeToValue } from '../node.ts'
import { FormatError } from '../records.ts'

export function nodeToToml(node: DataNode): string {
  const value = nodeToValue(node)
  try {
    return stringify(value)
  } catch (e) {
    throw new FormatError(`TOML 导出失败：${(e as Error).message}`)
  }
}