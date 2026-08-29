<script setup lang="ts">
import type { HistoryEntry } from '@/lib/debugger/db'
import type { ColumnDef, ParseConfig } from '@/lib/debugger/model'
import { parseResponse } from '@/lib/debugger/parse'
import { computed, ref } from 'vue'
import ResponseTable from './ResponseTable.vue'

const props = defineProps<{ entry: HistoryEntry | null; parse: ParseConfig; columns: ColumnDef[] }>()
const view = ref<'console' | 'json' | 'list'>('console')

type Line = { t: string; c: string }
// 将 console 文本拆为带行级配色的行（模仿 curl 的 * / > / < 语义）
function consoleLines(text: string): Line[] {
  return text.split('\n').map((l) => {
    const s = l.trimStart()
    if (s.startsWith('>')) return { t: l, c: 'ln-req' }
    if (s.startsWith('<')) return { t: l, c: 'ln-res' }
    if (/error|timed out|timeout/i.test(l)) return { t: l, c: 'ln-err' }
    return { t: l, c: 'ln-ack' }
  })
}
function sCls(status?: number): string {
  if (!status || status < 100 || status >= 600) return 'httpd-ser'
  return `httpd-s${Math.floor(status / 100)}`
}

// 响应体是否能解析为列表 → 「列表」标签可用
const canList = computed(() => {
  if (!props.entry?.raw) return false
  return parseResponse(props.entry.raw, props.parse).rows.length > 0
})
// JSON 视图：优先漂亮打印，否则原样文本
const jsonText = computed(() => {
  const raw = props.entry?.raw ?? ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
})

const viewOpts = [
  { k: 'console' as const, label: '控制台', title: '完整的请求 / 响应收发过程日志' },
  { k: 'json' as const, label: 'JSON', title: '响应体的原始 JSON 或文本' },
  { k: 'list' as const, label: '列表', title: '按解析规则渲染为列表表格（需已配置并匹配到列表）' },
]
</script>

<template>
  <div v-if="entry" class="httpd-panel">
    <div class="httpd-panel-title">
      <span class="httpd-eyebrow text-muted-foreground">请求记录</span>
      <span class="httpd-pill" :class="sCls(entry.status)">{{ entry.status ?? 'ERR' }}</span>
      <span class="font-mono text-muted-foreground">{{ new Date(entry.ts).toLocaleString() }}</span>
      <span class="ml-auto flex gap-1">
        <button
          v-for="o in viewOpts" :key="o.k"
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="view === o.k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          :disabled="o.k === 'list' && !canList"
          :title="o.title + (o.k === 'list' && !canList ? '（未匹配到列表，不可用）' : '')"
          @click="view = o.k"
        >{{ o.label }}</button>
      </span>
    </div>
    <div v-if="view === 'console'" class="httpd-console max-h-[50vh] overflow-auto p-3">
      <span v-for="(ln, i) in consoleLines(entry.console)" :key="i" :class="ln.c" class="block whitespace-pre">{{ ln.t }}</span>
    </div>
    <div v-else-if="view === 'json'" class="httpd-console max-h-[50vh] overflow-auto p-3">
      <pre class="whitespace-pre-wrap font-mono text-xs text-foreground">{{ jsonText }}</pre>
    </div>
    <div v-else class="httpd-console max-h-[50vh] overflow-auto">
      <ResponseTable v-if="canList && entry.raw" :rows="parseResponse(entry.raw, parse).rows" :columns="columns" :page-size="Number.MAX_SAFE_INTEGER" />
      <p v-else class="p-3 font-mono text-xs text-muted-foreground">{{ entry.error ?? '该响应未匹配到列表，请先到「解析」页配置列表路径或点「✧ 自动推断」' }}</p>
    </div>
  </div>
</template>