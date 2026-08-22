<script setup lang="ts">
import { computed } from 'vue'
import { computeStats } from '@/lib/text/stats'

const props = defineProps<{ input: string }>()
const s = computed(() => computeStats(props.input))

const rows = computed(() => [
  { label: '字符数（UTF-16）', value: s.value.chars, hint: '含代理对按 2 计' },
  { label: '字符数（Code Points）', value: s.value.codePoints, hint: 'emoji 算 1' },
  { label: '字节数（UTF-8）', value: s.value.bytesUtf8, hint: 'TextEncoder' },
  { label: '字节数（UTF-16）', value: s.value.bytesUtf16, hint: '按 code unit' },
  { label: '行数', value: s.value.lines, hint: '' },
  { label: '非空行数', value: s.value.nonEmptyLines, hint: '' },
  { label: '单词数（按空白）', value: s.value.words, hint: '' },
  { label: '非 ASCII 字符', value: s.value.nonAscii, hint: '' },
])
</script>

<template>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <div v-for="r in rows" :key="r.label" class="flex items-center justify-between rounded-md border px-3 py-2">
      <div>
        <div class="text-sm">{{ r.label }}</div>
        <div v-if="r.hint" class="text-xs text-muted-foreground">{{ r.hint }}</div>
      </div>
      <span class="text-lg font-semibold tabular-nums">{{ r.value }}</span>
    </div>
  </div>
</template>