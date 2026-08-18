<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { renderMarkdownSafe } from '@/lib/markdown'
import 'highlight.js/styles/github.css'

const router = useRouter()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const previewHtml = computed(() => renderMarkdownSafe(input.value))

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

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'
  inputEl.accept = '.md,.markdown'
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      input.value = reader.result as string
      nextTick(() => autoResize(textareaRef.value))
    }
    reader.readAsText(file)
  }
  inputEl.click()
}

function handleExport() {
  const blob = new Blob([input.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.md'
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
      <h2 class="text-lg font-semibold">Markdown 编辑器</h2>
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

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          ✏️ 编辑
        </div>
        <textarea
          ref="textareaRef"
          v-model="input"
          placeholder="在此输入 Markdown..."
          class="w-full resize-none overflow-hidden bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
          @input="handleInput"
        />
      </div>
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览
        </div>
        <div
          class="prose prose-sm dark:prose-invert w-full p-4 max-w-none"
          v-html="previewHtml"
        />
      </div>
    </div>
  </div>
</template>