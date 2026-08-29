<script setup lang="ts">
import { getHistory, type HistoryEntry } from '@/lib/debugger/db'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ apiId: string }>()
const entries = ref<HistoryEntry[]>([])
const picked = ref<HistoryEntry | null>(null)
const view = ref<'console' | 'response'>('console')
function isBad(e: HistoryEntry): boolean {
  return !!e.error || !!e.status && (e.status < 200 || e.status >= 300)
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
  <div class="rounded-lg border border-border">
    <ul v-if="entries.length" class="divide-y divide-border text-sm">
      <li v-for="(e, i) in entries" :key="i" class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent" :class="picked === e ? 'bg-accent' : ''" @click="pick(e)">
        <span class="font-mono text-xs" :class="isBad(e) ? 'text-destructive' : 'text-green-600 dark:text-green-400'">{{ e.status ?? 'ERR' }}</span>
        <span class="text-xs text-muted-foreground">{{ new Date(e.ts).toLocaleString() }}</span>
        <span class="ml-auto text-xs text-muted-foreground">{{ e.size !== undefined ? `${e.ms}ms · ${e.size} B` : `${e.ms}ms` }}</span>
      </li>
    </ul>
    <p v-else class="p-4 text-sm text-muted-foreground">暂无历史记录。</p>
  </div>

  <div v-if="picked" class="mt-3 rounded-lg border border-border">
    <div class="flex items-center gap-2 border-b border-border px-2 py-1">
      <span class="ml-auto flex gap-1">
        <button class="rounded-md px-3 py-1 text-xs" :class="view === 'console' ? 'bg-accent' : 'hover:bg-accent'" @click="view='console'">Console</button>
        <button class="rounded-md px-3 py-1 text-xs" :class="view === 'response' ? 'bg-accent' : 'hover:bg-accent'" @click="view='response'">Response</button>
      </span>
    </div>
    <pre v-if="view === 'console'" class="max-h-[50vh] overflow-auto p-3 font-mono text-xs">{{ picked.console }}</pre>
    <pre v-else class="max-h-[50vh] overflow-auto p-3 font-mono text-xs">{{ picked.raw ?? picked.error ?? '（无响应体）' }}</pre>
  </div>
</template>