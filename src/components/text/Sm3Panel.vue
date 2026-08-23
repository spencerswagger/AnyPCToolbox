<script setup lang="ts">
import { ref, watch } from 'vue'
import { sm3Hash, type SmResult } from '@/lib/text/sm'

const props = defineProps<{ input: string }>()

const result = ref<SmResult | null>(null)
const upper = ref(false)
const computing = ref(false)

watch(
  () => props.input,
  async () => {
    if (!props.input) {
      result.value = null
      return
    }
    computing.value = true
    result.value = sm3Hash(props.input)
    computing.value = false
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
    <div v-else-if="!input" class="text-sm text-muted-foreground">输入文本开始计算 SM3</div>
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
        <span class="w-16 shrink-0 text-sm font-medium text-muted-foreground">SM3</span>
        <code v-if="result?.ok" class="min-w-0 flex-1 break-all font-mono text-xs">{{ disp(result.value) }}</code>
        <code v-else class="min-w-0 flex-1 break-all font-mono text-xs text-destructive">{{ result?.error }}</code>
        <button
          v-if="result?.ok"
          class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @click="copy(disp(result.value))"
        >
          复制
        </button>
      </div>
    </template>
  </div>
</template>