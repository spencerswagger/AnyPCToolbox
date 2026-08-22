<script setup lang="ts">
import { ref, watch } from 'vue'
import { computeHashes, type HashItem } from '@/lib/text/hashes'

const props = defineProps<{ input: string }>()

const items = ref<HashItem[]>([])
const computing = ref(false)

watch(
  () => props.input,
  async (v) => {
    if (!v) {
      items.value = []
      return
    }
    computing.value = true
    try {
      items.value = await computeHashes(v)
    } finally {
      computing.value = false
    }
  },
  { immediate: true },
)

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
    <div v-if="computing" class="text-sm text-muted-foreground">计算中…</div>
    <div v-else-if="!input" class="text-sm text-muted-foreground">输入文本开始计算哈希</div>
    <div v-else class="space-y-1">
      <div v-for="item in items" :key="item.id" class="flex items-center gap-2 rounded-md border px-3 py-1.5">
        <span class="w-20 shrink-0 text-sm font-medium text-muted-foreground">{{ item.label }}</span>
        <code class="min-w-0 flex-1 break-all font-mono text-xs">{{ item.error ?? item.value }}</code>
        <button
          v-if="!item.error"
          class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @click="copy(item.value)"
        >
          复制
        </button>
      </div>
    </div>
  </div>
</template>