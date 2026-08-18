<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import hljs from 'highlight.js'
import { formatJson, compressJson } from '@/lib/json'
import 'highlight.js/styles/github.css'

const router = useRouter()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const error = computed(() => {
  if (!input.value.trim()) return null
  try {
    JSON.parse(input.value)
    return null
  } catch (e) {
    return (e as Error).message
  }
})

const parsed = computed(() => {
  if (!input.value.trim()) return null
  try {
    return JSON.parse(input.value)
  } catch {
    return null
  }
})

const highlightedHtml = computed(() => {
  if (!input.value.trim()) {
    return '<span class="text-muted-foreground">输入 JSON 数据开始预览...</span>'
  }
  try {
    return hljs.highlight(input.value, { language: 'json' }).value
  } catch {
    return escapeHtml(input.value)
  }
})

const editorHighlight = computed(() => {
  if (!input.value.trim()) {
    return ''
  }
  try {
    return hljs.highlight(input.value, { language: 'json' }).value
  } catch {
    return escapeHtml(input.value)
  }
})

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

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

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  nextTick(() => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  })
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  autoResize(target)
}

watch(input, () => {
  nextTick(() => autoResize(textareaRef.value))
})

function handleFormat() {
  if (!input.value.trim()) return
  try {
    input.value = formatJson(input.value)
  } catch {
    // error is handled by computed
  }
}

function handleCompress() {
  if (!input.value.trim()) return
  try {
    input.value = compressJson(input.value)
  } catch {
    // error is handled by computed
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
        <div class="editor-wrapper relative">
          <pre
            class="editor-code pointer-events-none m-0 whitespace-pre p-4 font-mono text-sm leading-relaxed"
            aria-hidden="true"
          ><code class="hljs language-json" v-html="editorHighlight"></code></pre>
          <textarea
            ref="textareaRef"
            v-model="input"
            placeholder="输入 JSON 数据..."
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            class="editor-textarea w-full resize-none overflow-hidden bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
            @input="handleInput"
          />
        </div>
      </div>
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览
        </div>
        <pre
          class="hljs w-full whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed"
          v-html="highlightedHtml"
        ></pre>
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
.editor-wrapper {
  position: relative;
  width: 100%;
}

.editor-code {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1rem;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.875rem;
  line-height: 1.625;
  background: transparent !important;
}

.editor-code code {
  background: transparent !important;
  padding: 0 !important;
  white-space: pre !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
}

.editor-textarea {
  position: relative;
  color: transparent;
  caret-color: hsl(var(--foreground));
  background: transparent;
}

.editor-textarea::selection {
  background: hsl(var(--primary) / 0.3);
}
</style>