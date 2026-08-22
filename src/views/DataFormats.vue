<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import hljs from 'highlight.js'
import { FORMATS, getFormat } from '@/lib/dataformats/registry'
import type { FlattenStrategy, Records, Cell } from '@/lib/dataformats/records'
import 'highlight.js/styles/github.css'

const router = useRouter()

const sourceFormatId = ref('json')
const targetFormatId = ref('yaml')
const strategy = ref<FlattenStrategy>('flatten')
const sourceText = ref('')
const hidden = ref<Set<string>>(new Set())
const order = ref<string[]>([])
const page = ref(0)
const PAGE_SIZE = 50

const sourceFormat = computed(() => getFormat(sourceFormatId.value)!)
const targetFormat = computed(() => getFormat(targetFormatId.value)!)

const records = computed<Records | null>(() => {
  if (!sourceText.value.trim()) return { columns: [], rows: [] }
  try {
    return sourceFormat.value.importer(sourceText.value, strategy.value)
  } catch {
    return null
  }
})

const error = computed<string | null>(() => {
  if (!sourceText.value.trim()) return null
  try {
    sourceFormat.value.importer(sourceText.value, strategy.value)
    return null
  } catch (e) {
    return (e as Error).message
  }
})

// 格式化源文本失败时单独呈现（与解析错误区分的提示）
const formatMsg = ref<string | null>(null)

function formatSource() {
  if (!sourceText.value.trim()) return
  const f = sourceFormat.value.format
  if (!f) return
  formatMsg.value = null
  try {
    sourceText.value = f(sourceText.value)
  } catch (e) {
    formatMsg.value = (e as Error).message
  }
}

watch(sourceText, () => {
  formatMsg.value = null
  nextTick(() => autoResize(textareaRef.value))
})

const stats = computed(() => {
  if (!sourceText.value.trim()) return { lines: 0, chars: 0, bytes: 0 }
  return {
    lines: sourceText.value.split('\n').length,
    chars: sourceText.value.length,
    bytes: new Blob([sourceText.value]).size,
  }
})

function currentBase(): string[] {
  const all = records.value?.columns ?? []
  if (order.value.length) return order.value.filter((c) => all.includes(c))
  return all
}

const effectiveColumns = computed(() =>
  currentBase().filter((c) => !hidden.value.has(c)),
)

const visibleRows = computed(() => {
  if (!records.value) return []
  const cols = records.value.columns
  const idx = effectiveColumns.value
    .map((c) => cols.indexOf(c))
    .filter((i) => i >= 0)
  return records.value.rows.map((r) => idx.map((i) => r[i]))
})

const pageRows = computed(() => {
  const start = page.value * PAGE_SIZE
  return visibleRows.value.slice(start, start + PAGE_SIZE)
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(visibleRows.value.length / PAGE_SIZE)),
)

const targetText = computed(() => {
  const rec = records.value
  if (!rec || rec.columns.length === 0) return ''
  const eff = effectiveColumns.value
  const idx = eff.map((c) => rec.columns.indexOf(c)).filter((i) => i >= 0)
  const slim: Records = {
    columns: eff,
    rows: rec.rows.map((r) => idx.map((i) => r[i])),
  }
  try {
    return targetFormat.value.exporter(slim)
  } catch {
    return ''
  }
})

function toggleCol(c: string) {
  const next = new Set(hidden.value)
  if (next.has(c)) next.delete(c)
  else next.add(c)
  hidden.value = next
}

function moveCol(c: string, dir: number) {
  const base = currentBase()
  const idx = base.indexOf(c)
  const j = idx + dir
  if (idx < 0 || j < 0 || j >= base.length) return
  const arr = [...base]
  ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
  order.value = arr
}

function formatCell(cell: Cell): string {
  if (cell === null) return ''
  if (cell === true) return 'true'
  if (cell === false) return 'false'
  return String(cell)
}

function resetColumns() {
  order.value = []
  hidden.value = new Set()
  page.value = 0
}

function handleReverse() {
  const prevTarget = targetText.value
  const s = sourceFormatId.value
  sourceFormatId.value = targetFormatId.value
  targetFormatId.value = s
  sourceText.value = prevTarget
  resetColumns()
}

function loadSample() {
  sourceText.value = sourceFormat.value.sample
  resetColumns()
}

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'
  inputEl.accept = `.${sourceFormat.value.ext}`
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      sourceText.value = reader.result as string
      resetColumns()
    }
    reader.readAsText(file, 'utf-8')
  }
  inputEl.click()
}

function handleExport() {
  if (!targetText.value) return
  const blob = new Blob([targetText.value])
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `export.${targetFormat.value.ext}`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(targetText.value)
  } catch {
    // fallback
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

const editorHighlight = computed(() => {
  if (!sourceText.value.trim()) return ''
  const lang = sourceFormat.value.id
  try {
    if (hljs.getLanguage(lang)) {
      const res = hljs.highlight(sourceText.value, { language: lang })
      return typeof res.value === 'string' ? res.value : escapeHtml(sourceText.value)
    }
    return escapeHtml(sourceText.value)
  } catch {
    return escapeHtml(sourceText.value)
  }
})

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const MIN_HEIGHT = 300

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  nextTick(() => {
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, MIN_HEIGHT) + 'px'
  })
}

watch(sourceFormatId, resetColumns)
watch(strategy, resetColumns)

interface SavedState {
  sourceText?: string
  sourceFormatId?: string
  targetFormatId?: string
}

onMounted(() => {
  try {
    const raw = localStorage.getItem('datafmt:last')
    if (raw) {
      const data = JSON.parse(raw) as SavedState
      if (data && typeof data === 'object') {
        if (typeof data.sourceText === 'string') sourceText.value = data.sourceText
        if (getFormat(data.sourceFormatId!)) sourceFormatId.value = data.sourceFormatId as string
        if (getFormat(data.targetFormatId!)) targetFormatId.value = data.targetFormatId as string
      }
    }
  } catch {
    // ignore
  }
})

watch(
  [sourceText, sourceFormatId, targetFormatId],
  () => {
    try {
      localStorage.setItem(
        'datafmt:last',
        JSON.stringify({
          sourceText: sourceText.value,
          sourceFormatId: sourceFormatId.value,
          targetFormatId: targetFormatId.value,
        }),
      )
    } catch {
      // ignore
    }
  },
  { deep: false },
)
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
      <h2 class="text-lg font-semibold">结构化数据互转</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleCopy"
        >
          复制结果
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
      <select
        v-model="sourceFormatId"
        class="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="handleReverse"
      >
        ⇄ 反向
      </button>
      <select
        v-model="targetFormatId"
        class="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
      <span class="mx-1 text-muted-foreground">|</span>
      <select
        v-model="strategy"
        class="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        <option value="flatten">flatten 点路径展开</option>
        <option value="firstLevel">firstLevel 仅顶层</option>
        <option value="raw">raw 整块JSON串</option>
      </select>
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="formatSource"
        :disabled="!sourceText.trim() || !sourceFormat.format"
      >
        格式化
      </button>
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="loadSample"
      >
        加载示例
      </button>
    </div>

    <div v-if="error || formatMsg" class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>⚠️</span>
      <span>{{ formatMsg || error }}</span>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          ✏️ 源数据（{{ sourceFormat.label }}）
        </div>
        <div class="editor-wrapper relative min-h-[300px]">
          <pre
            class="editor-code pointer-events-none m-0 whitespace-pre p-4 font-mono text-sm leading-relaxed min-h-[300px]"
            aria-hidden="true"
          ><code class="hljs" v-html="editorHighlight"></code></pre>
          <textarea
            ref="textareaRef"
            v-model="sourceText"
            placeholder="粘贴数据或导入文件..."
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            class="editor-textarea w-full resize-none overflow-hidden bg-transparent p-4 font-mono text-sm leading-relaxed outline-none"
            @input="autoResize($event.target as HTMLTextAreaElement)"
          />
        </div>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览表格
        </div>
        <div class="min-h-[300px] flex-1 overflow-auto">
          <div v-if="records === null" class="flex min-h-[300px] items-center justify-center p-4 text-sm text-muted-foreground">
            解析失败，请检查输入
          </div>
          <div v-else-if="currentBase().length === 0" class="flex min-h-[300px] items-center justify-center p-4 text-sm text-muted-foreground">
            输入数据以预览表格...
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b bg-accent/50">
                <th
                  v-for="c in currentBase()"
                  :key="c"
                  class="px-3 py-2 text-left align-top"
                  :class="hidden.has(c) ? 'opacity-40' : ''"
                >
                  <div class="flex items-center gap-1">
                    <input
                      type="checkbox"
                      :checked="!hidden.has(c)"
                      class="h-3.5 w-3.5 shrink-0"
                      :title="(hidden.has(c) ? '显示 ' : '隐藏 ') + c"
                      @change="toggleCol(c)"
                    />
                    <span class="break-all font-medium">{{ c }}</span>
                    <span class="ml-auto flex items-center gap-0.5">
                      <button
                        class="rounded border border-input px-1 text-xs hover:bg-accent"
                        :disabled="currentBase().indexOf(c) === 0"
                        @click="moveCol(c, -1)"
                      >↑</button>
                      <button
                        class="rounded border border-input px-1 text-xs hover:bg-accent"
                        :disabled="currentBase().indexOf(c) === currentBase().length - 1"
                        @click="moveCol(c, 1)"
                      >↓</button>
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in pageRows" :key="ri" class="border-b last:border-b-0">
                <td v-for="(cell, ci) in row" :key="ci" class="whitespace-pre-wrap break-all px-3 py-1.5 align-top">
                  {{ formatCell(cell) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>行数: {{ visibleRows.length }} | 列数: {{ effectiveColumns.length }}</span>
          <div v-if="visibleRows.length" class="flex items-center gap-1">
            <button
              class="rounded border border-input px-1.5 py-0.5 hover:bg-accent disabled:opacity-40"
              :disabled="page === 0"
              @click="page--"
            >上一页</button>
            <span>{{ page + 1 }} / {{ totalPages }}</span>
            <button
              class="rounded border border-input px-1.5 py-0.5 hover:bg-accent disabled:opacity-40"
              :disabled="page >= totalPages - 1"
              @click="page++"
            >下一页</button>
          </div>
        </div>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          🎯 目标结果（{{ targetFormat.label }}）
        </div>
        <pre class="m-0 min-h-[300px] flex-1 whitespace-pre-wrap break-all p-4 font-mono text-sm leading-relaxed text-muted-foreground">{{ targetText || '（空）' }}</pre>
      </div>
    </div>

    <div class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="error === null && records && records.columns.length">✓ 校验通过 | 行数 {{ records.rows.length }} | 列数 {{ records.columns.length }}</span>
      <span v-else-if="error">✗ 校验失败</span>
      <span v-else>等待输入</span>
      <span>行数 {{ stats.lines }} | 字符数 {{ stats.chars }} | 字节 {{ stats.bytes }}</span>
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
  min-height: 300px;
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