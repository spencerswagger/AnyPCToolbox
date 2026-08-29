<script setup lang="ts">
import { getHistory, type HistoryEntry } from '@/lib/debugger/db'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ apiId: string }>()
const entries = ref<HistoryEntry[]>([])
const picked = ref<HistoryEntry | null>(null)
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
async function load() { entries.value = (await getHistory(props.apiId)).slice(0, 20) }
function pick(e: HistoryEntry) {
  picked.value = e
  view.value = 'console'
}
watch(() => props.apiId, load)
onMounted(load)
</script>

<template>
  <div class="httpd-panel">
    <div class="httpd-panel-title">
      <span class="httpd-eyebrow text-muted-foreground" title="该接口每次发送（成功或失败）都会记录在这里，点击任意一条可查看它的控制台日志与响应内容">历史记录</span>
      <span class="text-xs text-muted-foreground">（{{ entries.length }}）</span>
    </div>
    <ul v-if="entries.length" class="divide-y divide-border">
      <li v-for="e in entries" :key="e.ts" class="flex cursor-pointer items-center gap-3 px-3 py-2 text-xs hover:bg-accent" :class="picked === e ? 'bg-accent' : ''" @click="pick(e)">
        <span class="w-10 shrink-0 font-mono font-bold" :class="sCls(e.status)">{{ e.status ?? 'ERR' }}</span>
        <span class="shrink-0 text-muted-foreground">{{ new Date(e.ts).toLocaleString() }}</span>
        <span class="ml-auto shrink-0 font-mono text-muted-foreground">{{ e.size !== undefined ? (e.ms + 'ms · ' + e.size + 'B') : (e.ms + 'ms') }}</span>
      </li>
    </ul>
    <p v-else class="p-4 font-mono text-xs text-muted-foreground">// 暂无请求记录，请在「运行」页发送一次请求</p>
  </div>

  <div v-if="picked" class="httpd-panel mt-3">
    <div class="httpd-panel-title">
      <span class="httpd-eyebrow text-muted-foreground">请求记录</span>
      <span class="font-mono text-muted-foreground">{{ new Date(picked.ts).toLocaleString() }}</span>
      <span class="ml-auto flex gap-1">
        <button class="rounded px-2 py-0.5 text-xs font-medium" :class="view === 'console' ? 'bg-accent' : 'hover:bg-accent'" @click="view='console'" title="查看该请求完整的发送过程日志（请求行、请求头、响应行、耗时等）">控制台</button>
        <button class="rounded px-2 py-0.5 text-xs font-medium" :class="view === 'response' ? 'bg-accent' : 'hover:bg-accent'" @click="view='response'" title="查看该请求的响应原始内容">响应</button>
      </span>
    </div>
    <div v-if="view === 'console'" class="httpd-console max-h-[50vh] overflow-auto p-3">
      <span v-for="(ln, i) in consoleLines(picked.console)" :key="i" :class="ln.c" class="block whitespace-pre">{{ ln.t }}</span>
    </div>
    <pre v-else class="httpd-console max-h-[50vh] overflow-auto p-3 whitespace-pre-wrap">{{ picked.raw ?? picked.error ?? '（无响应体）' }}</pre>
  </div>
</template>