import type { DataNode } from '../node.ts'
import { nodeToValue } from '../node.ts'

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 把 DataNode 作为一个名为 tag 的元素输出若干行（数组→同名重复元素）。
function emit(lines: string[], depth: number, tag: string, node: DataNode): void {
  const pad = '  '.repeat(depth)
  if (node.type === 'scalar') {
    lines.push(`${pad}<${tag}>${xmlEsc(String(node.value))}</${tag}>`)
    return
  }
  if (node.type === 'array') {
    for (const el of node.value) emit(lines, depth, tag, el)
    return
  }
  // dict：@ 前缀为属性，#text 为文本，其余为子元素
  const attrs: [string, string][] = []
  const children: [string, DataNode][] = []
  let text = ''
  for (const k of Object.keys(node.value)) {
    const v = node.value[k]
    if (k.startsWith('@')) attrs.push([k.slice(1), String(nodeToValue(v))])
    else if (k === '#text') text = String(nodeToValue(v))
    else children.push([k, v])
  }
  const attrStr = attrs.map(([n, v]) => ` ${n}="${xmlEsc(v)}"`).join('')
  if (children.length === 0 && !text) {
    lines.push(`${pad}<${tag}${attrStr}/>`)
    return
  }
  lines.push(`${pad}<${tag}${attrStr}>`)
  if (text) lines.push(`${pad}  ${xmlEsc(text)}`)
  for (const [name, child] of children) emit(lines, depth + 1, name, child)
  lines.push(`${pad}</${tag}>`)
}

export function nodeToXml(node: DataNode): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>']
  if (node.type === 'dict') {
    for (const k of Object.keys(node.value)) emit(lines, 0, k, node.value[k])
  } else {
    emit(lines, 0, 'root', node)
  }
  return lines.join('\n')
}