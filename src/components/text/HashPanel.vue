<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { computeHash, type HashId } from '@/lib/text/hashes'

const props = defineProps<{ input: string; algo: string }>()

const LABELS: Record<string, string> = {
  md5: 'MD5',
  crc32: 'CRC32',
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha512: 'SHA-512',
}

const value = ref('')
const error = ref('')
const computing = ref(false)
const upper = ref(false)

watch(
  () => [props.input, props.algo] as const,
  async () => {
    if (!props.input) {
      value.value = ''
      error.value = ''
      return
    }
    computing.value = true
    try {
      const r = await computeHash(props.algo as HashId, props.input)
      value.value = r.value
      error.value = r.error ?? ''
    } finally {
      computing.value = false
    }
  },
  { immediate: true },
)

const display = computed(() => (upper.value ? value.value.toUpperCase() : value.value))

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
    <div v-else-if="!input" class="text-sm text-muted-foreground">输入文本开始计算 {{ LABELS[algo] }}</div>
    <template v-else>
      <label class="flex w-fit items-center gap-2 text-sm">
        <input
          v-model="upper"
          type="checkbox"
          class="h-4 w-4 rounded border-input outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-muted-foreground">Hex 大写</span>
      </label>
      <div class="flex items-center gap-2 rounded-md border px-3 py-2">
        <span class="w-20 shrink-0 text-sm font-medium text-muted-foreground">{{ LABELS[algo] }}</span>
        <code v-if="error" class="flex-1 break-all font-mono text-xs text-destructive">{{ error }}</code>
        <code v-else class="min-w-0 flex-1 break-all font-mono text-xs">{{ display }}</code>
        <button
          v-if="!error"
          class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @click="copy(display)"
        >
          复制
        </button>
      </div>
    </template>
  </div>
</template>