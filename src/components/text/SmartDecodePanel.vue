<script setup lang="ts">
import { ref, watch } from 'vue'
import { smartDecode, type SmartDecodeResult } from '@/lib/text/smartdecode'

const props = defineProps<{ input: string }>()
const maxRounds = ref(8)
const result = ref<SmartDecodeResult | null>(null)

watch(
  () => [props.input, maxRounds.value] as const,
  () => {
    if (!props.input) {
      result.value = null
      return
    }
    result.value = smartDecode(props.input, maxRounds.value, 12)
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
  <div class="space-y-3">
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">最大轮次</span>
      <input
        v-model.number="maxRounds"
        type="number"
        min="1"
        max="20"
        class="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>

    <div class="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
      𝒾 智能解码为启发式结果，结果仅供参考
    </div>

    <p v-if="!input" class="text-sm text-muted-foreground">输入文本开始自动解码</p>
    <div v-if="input && result && !result.chains.length" class="text-sm text-muted-foreground">
      未检测到可解码的内容
    </div>
    <div v-else-if="input && result && result.chains.length" class="space-y-2">
      <div v-if="result.truncated" class="text-xs text-muted-foreground">已达结果上限，已截断</div>
      <div v-for="(c, i) in result.chains" :key="i" class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-1.5 text-xs text-muted-foreground">
          候选 {{ i + 1 }} · 置信度 {{ c.score }}
        </div>
        <div class="space-y-1 p-3">
          <div v-for="(step, j) in c.steps" :key="j" class="flex items-center gap-2 text-sm">
            <span class="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs">{{ step.algorithm }}</span>
            <code class="min-w-0 flex-1 break-all font-mono text-xs">{{ step.output }}</code>
            <span class="shrink-0 text-xs text-muted-foreground">{{ step.score }}</span>
          </div>
          <div class="mt-2 flex items-center gap-2 border-t pt-2">
            <span class="shrink-0 text-xs text-muted-foreground">最终</span>
            <code class="min-w-0 flex-1 break-all font-mono text-sm">{{ c.final }}</code>
            <button class="shrink-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(c.final)">复制</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>