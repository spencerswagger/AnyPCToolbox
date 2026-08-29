<script setup lang="ts">
import type { HistoryEntry } from '@/lib/debugger/db'
import type { ColumnDef, ParseConfig } from '@/lib/debugger/model'
import { ref } from 'vue'
import ResponseView from './ResponseView.vue'

defineProps<{ entry: HistoryEntry | null; parse: ParseConfig; columns: ColumnDef[] }>()
const view = ref<'console' | 'response'>('console')

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
</script>

<template>
  <div v-if="entry" class="httpd-panel">
    <div class="httpd-panel-title">
      <span class="httpd-eyebrow text-muted-foreground">请求记录</span>
      <span class="httpd-pill" :class="sCls(entry.status)">{{ entry.status ?? 'ERR' }}</span>
      <span class="font-mono text-muted-foreground">{{ new Date(entry.ts).toLocaleString() }}</span>
      <span class="ml-auto flex gap-1">
        <button class="rounded px-2 py-0.5 text-xs font-medium" :class="view === 'console' ? 'bg-accent' : 'hover:bg-accent'" @click="view='console'" title="查看该请求完整的发送过程日志（请求行、请求头、响应行、耗时等）">控制台</button>
        <button class="rounded px-2 py-0.5 text-xs font-medium" :class="view === 'response' ? 'bg-accent' : 'hover:bg-accent'" @click="view='response'" title="查看该请求的响应（列表自动表格，其余按树状或原文展示）">响应</button>
      </span>
    </div>
    <div v-if="view === 'console'" class="httpd-console max-h-[50vh] overflow-auto p-3">
      <span v-for="(ln, i) in consoleLines(entry.console)" :key="i" :class="ln.c" class="block whitespace-pre">{{ ln.t }}</span>
    </div>
    <div v-else class="httpd-console max-h-[50vh] overflow-auto">
      <ResponseView v-if="entry.raw" :raw="entry.raw" :parse="parse" :columns="columns" max-height-class="min-h-0" />
      <pre v-else class="p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">{{ entry.error ?? '（无响应体）' }}</pre>
    </div>
  </div>
</template>