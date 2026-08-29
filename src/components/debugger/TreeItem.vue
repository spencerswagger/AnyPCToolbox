<script setup lang="ts">
import { ref } from 'vue'

export interface TNode {
  key: string
  kind: 'obj' | 'arr' | 'leaf' | 'el'
  valueText: string
  meta: string // 用于配色：j-str / j-num / j-bool / j-null / j-key / el
  children: TNode[]
}

defineProps<{ node: TNode }>()
const open = ref(true)
</script>

<template>
  <li class="whitespace-pre text-xs leading-6">
    <span class="flex items-start gap-1">
      <button v-if="node.children.length" class="w-3 shrink-0 select-none text-muted-foreground" @click="open = !open">{{ open ? '▾' : '▸' }}</button>
      <span v-else class="w-3 shrink-0" />
      <template v-if="node.key && node.kind !== 'el'">
        <span class="text-primary">{{ node.key }}</span><span class="text-muted-foreground">:&nbsp;</span>
      </template>
      <span class="tree-val" :class="'tv-' + (node.meta || 'j-null')">
        {{ node.kind === 'obj' || node.kind === 'arr' ? `${node.valueText}${open && node.children.length ? '' : ' …'}` : node.valueText }}
      </span>
    </span>
    <ul v-if="open && node.children.length" class="ml-3 border-l border-border pl-2">
      <TreeItem v-for="(c, i) in node.children" :key="i" :node="c" />
    </ul>
  </li>
</template>