<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DataNode, Primitive } from '@/lib/dataformats/node'

const props = defineProps<{ node: DataNode; name?: string; depth?: number }>()

// 顶层几级默认展开，深层收起
const open = ref((props.depth ?? 0) < 2)
const toggle = () => { open.value = !open.value }

const isLeaf = computed(() => props.node.type === 'scalar')

const entries = computed<{ k: string; v: DataNode }[]>(() => {
  const n = props.node
  if (n.type === 'dict') return Object.keys(n.value).map((k) => ({ k, v: n.value[k] }))
  if (n.type === 'array') return n.value.map((v, i) => ({ k: `[${i}]`, v }))
  return []
})

const leafText = computed(() => {
  const n = props.node
  if (n.type !== 'scalar') return ''
  return formatPrim(n.value)
})

function formatPrim(v: Primitive): string {
  if (v === null) return 'null'
  if (v === true || v === false) return String(v)
  return String(v)
}

const summary = computed(() => {
  const n = props.node
  if (n.type === 'dict') return `{} ${Object.keys(n.value).length} 项`
  if (n.type === 'array') return `[] ${n.value.length} 项`
  return ''
})

const padStyle = computed(() => ({ paddingLeft: `${(props.depth ?? 0) * 16 + 8}px` }))
</script>

<template>
  <div class="tree-node">
    <div
      class="flex items-baseline gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-accent/40"
      :style="padStyle"
    >
      <button
        v-if="!isLeaf"
        type="button"
        class="tree-caret h-4 w-4 flex-none text-muted-foreground hover:text-foreground"
        :aria-expanded="open"
        @click="toggle"
      >
        <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 transition-transform" :class="open ? 'rotate-90' : ''">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span v-else class="w-4 flex-none"></span>

      <span
        v-if="name !== undefined"
        class="break-all font-medium text-foreground"
      >{{ name }}</span>

      <span v-if="isLeaf" class="break-all font-mono text-muted-foreground">{{ leafText }}</span>
      <span v-else class="ml-1 break-all text-muted-foreground">{{ summary }}</span>
    </div>

    <template v-if="!isLeaf && open">
      <TreeView v-for="e in entries" :key="e.k" :node="e.v" :name="e.k" :depth="(depth ?? 0) + 1" />
    </template>
  </div>
</template>

<style scoped>
.tree-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  cursor: pointer;
}
</style>