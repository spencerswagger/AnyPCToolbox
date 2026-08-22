<script setup lang="ts">
import { computed } from 'vue'
import { extractTimestamps } from '@/lib/text/timestamp'

const props = defineProps<{ input: string }>()
const hits = computed(() => extractTimestamps(props.input))

const KIND_LABEL: Record<string, string> = { unixSec: 'Unix 秒', unixMs: 'Unix 毫秒', date: '日期串' }

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 静默 */
  }
}
</script>

<template>
  <div class="space-y-2">
    <p v-if="!input || hits.length === 0" class="text-sm text-muted-foreground">
      {{ input ? '未识别到时间戳' : '输入文本开始扫描时间戳' }}
    </p>
    <div v-else class="space-y-1">
      <div v-for="(h, i) in hits" :key="i" class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
        <span class="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs">{{ KIND_LABEL[h.kind] }}</span>
        <code class="shrink-0 font-mono text-xs">{{ h.raw }}</code>
        <span class="min-w-0 flex-1 text-muted-foreground">{{ h.local }}</span>
        <code class="hidden shrink-0 font-mono text-xs sm:inline">{{ h.iso }}</code>
        <button class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(h.iso)">复制 ISO</button>
      </div>
    </div>
  </div>
</template>