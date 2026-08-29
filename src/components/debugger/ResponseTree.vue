<script setup lang="ts">
import { computed } from 'vue'
import TreeItem, { type TNode } from './TreeItem.vue'

const props = defineProps<{ raw: string }>()

function node(key: string, kind: TNode['kind'], valueText: string, meta: string, children: TNode[] = []): TNode {
  return { key, kind, valueText, meta, children }
}

function jsonT(key: string, v: unknown): TNode {
  if (v === null) return node(key, 'leaf', 'null', 'j-null')
  const t = typeof v
  if (t === 'string') return node(key, 'leaf', JSON.stringify(v), 'j-str')
  if (t === 'number') return node(key, 'leaf', String(v), 'j-num')
  if (t === 'boolean') return node(key, 'leaf', String(v), 'j-bool')
  if (Array.isArray(v)) return node(key, 'arr', `array[${v.length}]`, 'j-key', v.map((x, i) => jsonT(String(i), x)))
  if (t === 'object') return node(key, 'obj', 'object', 'j-key', Object.entries(v as Record<string, unknown>).map(([k, x]) => jsonT(k, x)))
  return node(key, 'leaf', String(v), 'j-null')
}

function elT(el: Element): TNode {
  const attrs = Array.from(el.attributes || []).map((a) => `${a.name}="${a.value}"`).join(' ')
  const kids = Array.from(el.children)
  const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n.textContent || '').trim()).join('').trim()
  if (!kids.length) {
    return node(el.tagName, 'leaf', text ? `<${el.tagName}${attrs ? ' ' + attrs : ''}>${text}</${el.tagName}>` : `<${el.tagName}${attrs ? ' ' + attrs : ''}/>`, 'el')
  }
  return { key: el.tagName, kind: 'el', valueText: `<${el.tagName}${attrs ? ' ' + attrs : ''}>`, meta: 'el', children: kids.map(elT) }
}

const parsed = computed<{ label: string; nodes: TNode[] } | null>(() => {
  const raw = props.raw ?? ''
  try {
    const j = JSON.parse(raw)
    return { label: 'JSON', nodes: [jsonT('root', j)] }
  } catch {
    const d = new DOMParser().parseFromString(raw, 'text/xml')
    if (!d.querySelector('parsererror') && d.documentElement) {
      return { label: 'XML', nodes: [elT(d.documentElement)] }
    }
    return null
  }
})
</script>

<template>
  <div class="httpd-console max-h-[60vh] overflow-auto">
    <div v-if="parsed" class="mb-1 flex items-center gap-2 border-b border-border px-3 py-1 text-xs text-muted-foreground">
      <span class="httpd-eyebrow">树状视图</span>
      <span class="httpd-chip httpd-chip-bg">{{ parsed.label }}</span>
    </div>
    <ul v-if="parsed" class="p-2">
      <TreeItem v-for="(n, i) in parsed.nodes" :key="i" :node="n" />
    </ul>
    <p v-else class="p-3 font-mono text-xs text-muted-foreground">// 该响应既非 JSON 也非 XML，无法生成树状结构，请切换到「原始」视图</p>
  </div>
</template>