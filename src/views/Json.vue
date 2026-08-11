<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { validateJson, formatJson, compressJson, syntaxHighlightJson } from '@/lib/json'

const router = useRouter()
const input = ref('')
const error = ref<string | null>(null)
const parsed = ref<unknown>(null)

const highlightedHtml = computed(() => {
  if (parsed.value === null || parsed.value === undefined) {
    return '<span class="text-muted-foreground">输入 JSON 数据开始预览...</span>'
  }
  return syntaxHighlightJson(parsed.value)
})

const stats = computed(() => {
  if (!input.value.trim()) {
    return { lines: 0, chars: 0, bytes: 0 }
  }
  return {
    lines: input.value.split('\n').length,
    chars: input.value.length,
    bytes: new Blob([input.value]).size,
  }
})

function handleFormat() {
  if (!input.value.trim()) return
  try {
    input.value = formatJson(input.value)
    error.value = null
    parsed.value = JSON.parse(input.value)
  } catch (e) {
    error.value = (e as Error).message
  }
}

function handleCompress() {
  if (!input.value.trim()) return
  try {
    input.value = compressJson(input.value)
    error.value = null
    parsed.value = JSON.parse(input.value)
  } catch (e) {
    error.value = (e as Error).message
  }
}

function handleValidate() {
  if (!input.value.trim()) {
    error.value = null
    parsed.value = null
    return
  }
  const result = validateJson(input.value)
  if (result.valid) {
    error.value = null
    parsed.value = result.parsed
  } else {
    error.value = result.error
    parsed.value = null
  }
}

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'
  inputEl.accept = '.json'
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      input.value = reader.result as string
      handleValidate()
    }
    reader.readAsText(file)
  }
  inputEl.click()
}

function handleExport() {
  const blob = new Blob([input.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(input.value)
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">JSON 编辑器</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleCopy"
        >
          复制
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleImport"
        >
          导入
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="handleExport"
        >
          导出
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <button
        class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        @click="handleFormat"
      >
        格式化
      </button>
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="handleCompress"
      >
        压缩
      </button>
      <div class="h-5 w-px bg-border" />
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="handleValidate"
      >
        校验
      </button>
    </div>

    <div v-if="error" class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>⚠️</span>
      <span>{{ error }}</span>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          ✏️ 编辑
        </div>
        <textarea
          v-model="input"
          placeholder="输入 JSON 数据..."
          class="min-h-[400px] w-full resize-none bg-transparent p-4 font-mono text-sm outline-none"
        />
      </div>
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览
        </div>
        <div
          class="min-h-[400px] w-full p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
          v-html="highlightedHtml"
        />
      </div>
    </div>

    <div class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="error === null && parsed !== null">✓ 校验通过</span>
      <span v-else-if="error">✗ 校验失败</span>
      <span v-else>等待输入</span>
      <span>
        行数: {{ stats.lines }} | 字符数: {{ stats.chars }} | 大小: {{ stats.bytes }} B
      </span>
    </div>
  </div>
</template>

<style scoped>
.json-key { color: #2563eb; }
.json-string { color: #059669; }
.json-number { color: #d97706; }
.json-boolean { color: #c026d3; }
.json-null { color: #94a3b8; }
.json-bracket { color: #64748b; }

:root.dark .json-key { color: #60a5fa; }
:root.dark .json-string { color: #34d399; }
:root.dark .json-number { color: #fbbf24; }
:root.dark .json-boolean { color: #c084fc; }
:root.dark .json-null { color: #64748b; }
:root.dark .json-bracket { color: #94a3b8; }
</style>