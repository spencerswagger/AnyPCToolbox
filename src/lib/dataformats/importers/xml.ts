import { FormatError, headerDedup, type Cell, type FlattenStrategy } from '../records.ts'

function elementToRow(el: Element, prefix: string, strategy: FlattenStrategy, depth: number): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  const path = (key: string) => (prefix ? `${prefix}.${key}` : key)
  for (const attr of Array.from(el.attributes)) {
    out[path(`@${attr.name}`)] = attr.value
  }
  const elemChildren = Array.from(el.children)
  if (elemChildren.length === 0) {
    out[prefix || 'data'] = (el.textContent ?? '') as Cell
    return out
  }
  for (const child of elemChildren) {
    const subPrefix = path(child.nodeName)
    if (strategy === 'firstLevel' || depth >= 5) {
      out[subPrefix] = (child.textContent ?? '') as Cell
    } else {
      Object.assign(out, elementToRow(child, subPrefix, strategy, depth + 1))
    }
  }
  return out
}

export function xmlToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new FormatError('XML 解析失败：无法解析 XML')
  const root = doc.documentElement
  if (!root) return { columns: [], rows: [] }
  const children = Array.from(root.children)
  if (children.length === 0) return { columns: ['data'], rows: [[(root.textContent ?? '') as Cell]] }
  const rowMaps = children.map((el) => elementToRow(el, '', strategy, 0))
  const columns = headerDedup([...new Set(rowMaps.flatMap(Object.keys))])
  const rows = rowMaps.map((m) => columns.map((c) => m[c] ?? null))
  return { columns, rows }
}