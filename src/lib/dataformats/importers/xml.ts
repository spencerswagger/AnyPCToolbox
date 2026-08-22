import type { DataNode } from '../node.ts'
import { dict, list, scalar } from '../node.ts'
import { FormatError } from '../records.ts'

function trimmedText(el: Element): string {
  return (el.textContent ?? '').trim()
}

// 一个元素 → DataNode：
// - 无子元素/无属性 → 文本标量
// - 有子元素 → dict（同名多次成为数组）
// - 属性 → '@name' 键
function elementToNode(el: Element): DataNode {
  const attrs = Array.from(el.attributes)
  const childEls = Array.from(el.children)
  const obj: Record<string, DataNode> = {}
  if (attrs.length === 0 && childEls.length === 0) {
    return scalar(trimmedText(el))
  }
  for (const a of attrs) obj[`@${a.name}`] = scalar(a.value)
  if (childEls.length > 0) {
    const groups = new Map<string, Element[]>()
    for (const c of childEls) {
      const arr = groups.get(c.nodeName) ?? []
      arr.push(c)
      groups.set(c.nodeName, arr)
    }
    for (const [name, arr] of groups) {
      obj[name] = arr.length === 1 ? elementToNode(arr[0]) : list(arr.map(elementToNode))
    }
  } else if (attrs.length > 0) {
    const t = trimmedText(el)
    if (t) obj['#text'] = scalar(t)
  }
  if (Object.keys(obj).length === 0) return scalar('')
  return dict(obj)
}

export function xmlToNode(text: string): DataNode {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new FormatError('XML 解析失败：无法解析 XML')
  const root = doc.documentElement
  if (!root) return { type: 'array', value: [] }
  return dict({ [root.nodeName]: elementToNode(root) })
}