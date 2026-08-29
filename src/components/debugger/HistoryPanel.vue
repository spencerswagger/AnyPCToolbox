<script setup lang="ts">
import { getHistory, type HistoryEntry } from '@/lib/debugger/db'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ apiId: string }>()
const entries = ref<HistoryEntry[]>([])
const picked = ref<HistoryEntry | null>(null)
async function load() { entries.value = (await getHistory(props.apiId)).slice(0, 20) }
watch(() => props.apiId, load)
onMounted(load)
</script>

<template>
  <div class="rounded-lg border border-border">
    <ul v-if="entries.length" class="divide-y divide-border text-sm">
      <li v-for="(e, i) in entries" :key="i" class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent" @click="picked = e">
        <span class="font-mono text-xs" :class="e.status >= 200 && e.status < 300 ? 'text-green-600 dark:text-green-400' : 'text-destructive'">{{ e.status }}</span>
        <span class="text-xs text-muted-foreground">{{ new Date(e.ts).toLocaleString() }}</span>
        <span class="ml-auto text-xs text-muted-foreground">{{ e.ms }}ms · {{ e.size }} B</span>
      </li>
    </ul>
    <p v-else class="p-4 text-sm text-muted-foreground">暂无历史记录。</p>
  </div>
  <pre v-if="picked" class="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-border p-3 font-mono text-xs">{{ picked.raw }}</pre>
</template>