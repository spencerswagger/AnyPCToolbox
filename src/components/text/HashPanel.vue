<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { computeHash, type HashId } from '@/lib/text/hashes'

const props = defineProps<{ input: string; algo: string }>()

// “常用”tab 聚合常见哈希：MD5 + SHA 系列 + SM3
const COMMON_HASHES: { id: HashId; label: string }[] = [
  { id: 'md5', label: 'MD5' },
  { id: 'sha1', label: 'SHA-1' },
  { id: 'sha256', label: 'SHA-256' },
  { id: 'sha512', label: 'SHA-512' },
  { id: 'sm3', label: 'SM3' },
]

const isCommon = computed(() => props.algo === 'common')
const title = computed(() => (isCommon.value ? '常用哈希' : '哈希')) // 空态提示用

interface Row {
  label: string
  value: string
  error: string
}

const rows = ref<Row[]>([])
const computing = ref(false)
const upper = ref(false)

watch(
  () => [props.input, props.algo] as const,
  async () => {
    rows.value = []
    if (!props.input) {
      return
    }
    computing.value = true
    try {
      if (isCommon.value) {
        const results = await Promise.all(COMMON_HASHES.map((r) => computeHash(r.id, props.input)))
        rows.value = results.map((r) => ({ label: r.label, value: r.value, error: r.error ?? '' }))
      } else {
        const r = await computeHash(props.algo as HashId, props.input)
        rows.value = [{ label: r.label, value: r.value, error: r.error ?? '' }]
      }
    } finally {
      computing.value = false
    }
  },
  { immediate: true },
)

function disp(value: string): string {
  return upper.value ? value.toUpperCase() : value
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 静默 */
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="computing" class="text-sm text-muted-foreground">计算中…</div>
    <div v-else-if="!input" class="text-sm text-muted-foreground">输入文本开始计算 {{ title }}</div>
    <template v-else>
      <label class="flex w-fit items-center gap-2 text-sm">
        <input
          v-model="upper"
          type="checkbox"
          class="h-4 w-4 rounded border-input outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-muted-foreground">Hex 大写</span>
      </label>
      <div class="space-y-1">
        <div v-for="row in rows" :key="row.label" class="flex items-center gap-2 rounded-md border px-3 py-2">
          <span class="w-20 shrink-0 text-sm font-medium text-muted-foreground">{{ row.label }}</span>
          <code v-if="row.error" class="flex-1 break-all font-mono text-xs text-destructive">{{ row.error }}</code>
          <code v-else class="min-w-0 flex-1 break-all font-mono text-xs">{{ disp(row.value) }}</code>
          <button
            v-if="!row.error"
            class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            @click="copy(disp(row.value))"
          >
            复制
          </button>
        </div>
      </div>
    </template>
  </div>
</template>