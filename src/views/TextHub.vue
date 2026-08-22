<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { detectType } from '@/lib/text/detect'
import { computeStats } from '@/lib/text/stats'
import { CATEGORIES, TOOL_ITEMS } from '@/lib/text/registry'

const router = useRouter()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeCategory = ref('encode')
const activeItem = ref('encode')
const status = ref('')

// 该大类下的子项
const itemsInCategory = computed(() => TOOL_ITEMS.filter((t) => t.category === activeCategory.value))
const currentItem = computed(() => TOOL_ITEMS.find((t) => t.id === activeItem.value) ?? TOOL_ITEMS[0]!)

const inputType = computed(() => detectType(input.value))
const stats = computed(() => computeStats(input.value))

function selectCategory(cat: typeof CATEGORIES[number]['id']): void {
  activeCategory.value = cat
  const first = TOOL_ITEMS.find((t) => t.category === cat)
  if (first) activeItem.value = first.id
}
function selectItem(id: string): void {
  activeItem.value = id
}

function onInput(e: Event): void {
  const el = e.target as HTMLTextAreaElement
  void nextTick(() => autoResize(el))
}

const MIN_HEIGHT = 240
function autoResize(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, MIN_HEIGHT)}px`
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void nextTick(() => autoResize(textareaRef.value))
  }
}

async function copyInput(): Promise<void> {
  try {
    await navigator.clipboard.writeText(input.value)
    flashStatus('已复制输入')
  } catch {
    flashStatus('复制失败')
  }
}
function clearInput(): void {
  input.value = ''
  flashStatus('已清空')
}

function importFile(): void {
  const el = document.createElement('input')
  el.type = 'file'
  el.accept = '.txt,.text,text/plain'
  el.onchange = (): void => {
    const f = el.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (): void => {
      input.value = reader.result as string
    }
    reader.readAsText(f)
  }
  el.click()
}
function exportFile(): void {
  const blob = new Blob([input.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'text.txt'
  a.click()
  URL.revokeObjectURL(url)
}

let statusTimer: ReturnType<typeof setTimeout> | undefined
function flashStatus(msg: string): void {
  status.value = msg
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = ''
  }, 2500)
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">文本处理中台</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="importFile"
        >
          导入
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="exportFile"
        >
          导出
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="copyInput"
        >
          复制输入
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="clearInput"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 主体：左输入 + 右结果 -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr,1.6fr]">
      <!-- 左：输入区 -->
      <div class="flex flex-col rounded-lg border">
        <div class="flex items-center justify-between border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">✏️ 输入文本</span>
          <span class="rounded bg-accent px-1.5 py-0.5 text-xs">{{ inputType }}</span>
        </div>
        <textarea
          ref="textareaRef"
          v-model="input"
          rows="8"
          placeholder="粘贴文本，右侧即时产出编解码 / 哈希 / 统计 / 时间戳 / 智能解码结果&#10;Ctrl+Enter 刷新布局"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          class="w-full flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @input="onInput"
          @keydown="handleKeydown"
        />
      </div>

      <!-- 右：大类 Tab + 结果 -->
      <div class="flex flex-col rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">🔬 处理结果</span>
        </div>
        <div class="flex min-h-[360px]">
          <!-- 左侧大类 Tab -->
          <div class="flex flex-col border-r">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.id"
              class="px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="activeCategory === cat.id ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'"
              @click="selectCategory(cat.id)"
            >
              {{ cat.label }}
            </button>
          </div>
          <!-- 右侧大类内子项 + 结果面板 -->
          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex flex-wrap gap-1 border-b px-3 py-2">
              <button
                v-for="item in itemsInCategory"
                :key="item.id"
                class="rounded-md px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="activeItem === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'"
                @click="selectItem(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
            <div v-if="!input" class="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
              输入文本后，此处实时显示 {{ currentItem.label }} 结果
            </div>
            <div v-else class="flex-1 overflow-auto p-3">
              <component :is="currentItem.component" :input="input" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>字符数 {{ stats.chars }} · 行数 {{ stats.lines }} · 字节数(UTF-8) {{ stats.bytesUtf8 }}</span>
      <span :class="status ? 'font-medium text-foreground' : ''">{{ status }}</span>
      <span>已识别类型 {{ inputType }}</span>
    </div>
  </div>
</template>