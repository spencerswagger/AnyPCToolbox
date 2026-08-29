<script setup lang="ts">
import type { ColumnDef, ParseConfig } from '@/lib/debugger/model'
import { parseResponse, type ParseResult } from '@/lib/debugger/parse'
import { computed } from 'vue'
import ResponseTable from './ResponseTable.vue'
import ResponseTree from './ResponseTree.vue'
import JsonTree from './JsonTree.vue'

const props = withDefaults(defineProps<{
  raw: string
  parse: ParseConfig
  columns: ColumnDef[]
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  maxHeightClass?: string
}>(), { pageSize: Number.MAX_SAFE_INTEGER, maxHeightClass: 'max-h-[60vh] overflow-auto' })
const emit = defineEmits<{ (e: 'pick', path: string): void }>()

// 自动决定展示形态：能解析出列表就显示表格，否则是 JSON / XML 就显示树，再否则显示原文
const parsed = computed<ParseResult | null>(() => parseResponse(props.raw, props.parse))
const kind = computed<'table' | 'tree' | 'raw'>(() => {
  if (parsed.value?.ok && parsed.value.rows.length) return 'table'
  const t = props.raw.trim()
  if (parsed.value?.json) return 'tree'
  if (t.startsWith('{') || t.startsWith('[')) return 'tree' // JSON 但未匹配到列表 → 树状
  if (t.startsWith('<')) return 'tree' // XML → 树状（由 ResponseTree 独立解析）
  return 'raw'
})
</script>

<template>
  <ResponseTable
    v-if="kind === 'table' && parsed"
    :rows="parsed.rows" :total="total" :page="page ?? 1" :page-size="pageSize"
    :columns="columns" :loading="loading" :list-path="parse.listPath" @go="() => {}" @pick="(p) => emit('pick', p)"
  />
  <JsonTree
    v-else-if="kind === 'tree' && parsed?.json"
    :value="parsed.json" :pickable="true"
    :max-height-class="maxHeightClass" @pick="(p) => emit('pick', p)"
  />
  <ResponseTree v-else-if="kind === 'tree'" :raw="raw" />
  <pre v-else class="httpd-console whitespace-pre-wrap p-3 font-mono text-xs text-foreground" :class="maxHeightClass">{{ raw }}</pre>
</template>