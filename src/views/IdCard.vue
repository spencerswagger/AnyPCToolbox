<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { normalizeId, parseId, generateIds, type IdInfo, type Sex } from '@/lib/idcard'
import { areas, areaUpdatedAt } from '@/lib/areaData'
import AreaCascader from '@/components/AreaCascader.vue'

interface IdEntry {
  /** 18 位号码；无法归一化的输入保留原文 */
  id: string
  original: string
  addedAt: number
}

const STORAGE_KEY = 'idcard:list'
const router = useRouter()

const input = ref('')
const entries = ref<IdEntry[]>(loadEntries())
const selectedId = ref('')
const status = ref('')
const showGenerate = ref(false)

// 批量生成配置（地区为空 = 全国随机）
const genCount = ref(10)
const genSex = ref<'' | Sex>('')
const genMinAge = ref('')
const genMaxAge = ref('')
const genArea = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

function loadEntries(): IdEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (e): e is IdEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as IdEntry).id === 'string' &&
        typeof (e as IdEntry).original === 'string',
    )
  } catch {
    return []
  }
}

watch(
  entries,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      // 存储失败时静默忽略
    }
  },
  { deep: true },
)

const infos = computed(() => {
  const map = new Map<string, IdInfo>()
  for (const e of entries.value) map.set(e.id, parseId(e.id, areas))
  return map
})

const selectedEntry = computed(() => entries.value.find((e) => e.id === selectedId.value) ?? null)
const selectedInfo = computed(() => (selectedEntry.value ? (infos.value.get(selectedEntry.value.id) ?? null) : null))

const stats = computed(() => {
  let valid = 0
  for (const e of entries.value) if (infos.value.get(e.id)?.valid) valid++
  return { total: entries.value.length, valid, invalid: entries.value.length - valid }
})

let statusTimer: ReturnType<typeof setTimeout> | undefined
function flashStatus(msg: string): void {
  status.value = msg
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = ''
  }, 3000)
}

/** 输入框随内容行数自适应高度 */
function autoGrow(): void {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(64, el.scrollHeight)}px`
}
function resetGrow(): void {
  const el = inputEl.value
  if (el) el.style.height = 'auto'
}

/** 入列（去重）并选中第一个。去重按原始输入字符串；15 位升位可能与 18 位输入归一化相同，但视为两条不同条目。 */
function addIds(
  items: Array<{ id: string; original: string }>,
  source: 'submit' | 'generate',
): void {
  let firstId = ''
  let added = 0
  let dup = 0
  for (const it of items) {
    if (!firstId) firstId = it.id
    // 去重依据：按 original（提交）或按 id（生成，生成不会重复 original）
    const exists =
      source === 'submit'
        ? entries.value.some((e) => e.original === it.original)
        : entries.value.some((e) => e.id === it.id)
    if (exists) {
      dup++
      continue
    }
    entries.value.push({ id: it.id, original: it.original, addedAt: Date.now() })
    added++
  }
  selectedId.value = firstId
  flashStatus(`新增 ${added} 条${dup ? `，已存在 ${dup} 条` : ''}`)
}

function handleSubmit(): void {
  const lines = input.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!lines.length) return
  const items: Array<{ id: string; original: string }> = []
  for (const line of lines) {
    const norm = normalizeId(line)
    items.push({ id: norm.id ?? line, original: line })
  }
  addIds(items, 'submit')
  input.value = ''
  nextTick(() => resetGrow())
}

function handleGenerate(): void {
  const ids = generateIds(
    {
      count: Number(genCount.value) || 10,
      sex: genSex.value || undefined,
      minAge: genMinAge.value === '' ? undefined : Number(genMinAge.value),
      maxAge: genMaxAge.value === '' ? undefined : Number(genMaxAge.value),
      areaCode: genArea.value || undefined,
    },
    areas,
  )
  if (!ids.length) {
    flashStatus('生成失败：该地区无可用的区划码')
    return
  }
  addIds(
    ids.map((id) => ({ id, original: id })),
    'generate',
  )
  showGenerate.value = false
}

async function copyText(text: string, msg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    flashStatus(msg)
  } catch {
    flashStatus('复制失败')
  }
}

function copyOne(id: string): void {
  void copyText(id, '已复制 1 条')
}

function copyAll(): void {
  if (!entries.value.length) return
  void copyText(
    entries.value.map((e) => e.id).join('\n'),
    `已复制 ${entries.value.length} 条`,
  )
}

function clearAll(): void {
  entries.value = []
  selectedId.value = ''
  flashStatus('列表已清空')
}
function removeEntry(index: number): void {
  const [removed] = entries.value.splice(index, 1)
  if (!removed) return
  if (selectedId.value === removed.id) {
    selectedId.value = entries.value[Math.min(index, entries.value.length - 1)]?.id ?? ''
  }
  flashStatus('已删除 1 条')
}
</script>

<template>
  <div class="space-y-6">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">身份证号工具</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="showGenerate = true"
        >
          批量生成
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="copyAll"
        >
          全部复制
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="clearAll"
        >
          清空列表
        </button>
      </div>
    </div>

    <!-- 输入区（居中式，参考对话首页） -->
    <div class="mx-auto max-w-xl pt-2">
      <div class="relative">
        <textarea
          ref="inputEl"
          v-model="input"
          rows="1"
          spellcheck="false"
          autocomplete="off"
          placeholder="输入身份证号，一行一个（支持 15 位自动转 18 位），回车确认，Shift+Enter 换行..."
          class="block w-full resize-none overflow-hidden rounded-2xl bg-accent/60 py-3 pl-4 pr-24 text-sm font-mono leading-relaxed outline-none placeholder:text-muted-foreground focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @input="autoGrow"
          @keydown.enter.exact.prevent="handleSubmit"
        />
        <button
          class="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="handleSubmit"
        >
          确认
        </button>
      </div>
    </div>

    <!-- 主区：左列表 + 右预览 -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr,1.2fr]">
      <div class="flex flex-col rounded-lg border">
        <div class="flex items-center border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          📋 身份证号列表
          <span class="ml-auto normal-case tracking-normal">共 {{ stats.total }} 条</span>
        </div>
        <div
          v-if="!entries.length"
          class="flex min-h-[240px] flex-1 items-center justify-center p-4 text-sm text-muted-foreground"
        >
          暂无数据，请在顶部输入或生成
        </div>
        <ul v-else class="max-h-[480px] divide-y overflow-y-auto">
          <li v-for="(e, i) in entries" :key="e.original">
            <div
              role="button"
              tabindex="0"
              class="group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              :class="selectedId === e.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'"
              @click="selectedId = e.id"
              @keydown.enter.prevent="selectedId = e.id"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate font-mono">{{ e.id }}</div>
                <div v-if="e.original !== e.id" class="text-xs text-muted-foreground">
                  由 15 位升位：{{ e.original }}
                </div>
              </div>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-xs"
                :class="
                  infos.get(e.id)?.valid
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/15 text-destructive dark:bg-red-500/20 dark:text-red-400'
                "
              >
                {{ infos.get(e.id)?.valid ? '✓ 通过' : '✗ 不通过' }}
              </span>
              <button
                class="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 group-hover:opacity-100"
                title="复制"
                @click.stop="copyOne(e.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>
              <button
                class="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-400"
                title="删除"
                @click.stop="removeEntry(i)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          🔍 信息预览
        </div>
        <div
          v-if="!selectedEntry"
          class="flex min-h-[240px] flex-1 items-center justify-center p-4 text-sm text-muted-foreground"
        >
          点击左侧列表中的身份证号查看详情
        </div>
        <div v-else-if="selectedInfo" class="space-y-3 p-4">
          <div
            v-if="!selectedInfo.valid"
            class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-400"
          >
            <span>⚠️</span>
            <span>无效：{{ selectedInfo.reason }}</span>
          </div>
          <div
            v-else
            class="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <span>✓</span>
            <span>校验通过</span>
          </div>
          <dl class="space-y-2 text-sm">
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">身份证号</dt>
              <dd class="min-w-0 break-all font-mono">{{ selectedEntry.id }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">发证地</dt>
              <dd>{{ selectedInfo.sign || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">出生日期</dt>
              <dd>{{ selectedInfo.birthday || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">性别</dt>
              <dd>{{ selectedInfo.sex || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">年龄</dt>
              <dd>{{ selectedInfo.age !== null ? selectedInfo.age + ' 岁' : '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">号码类型</dt>
              <dd>{{ selectedInfo.type || '—' }}</dd>
            </div>
            <div v-if="selectedEntry.original !== selectedEntry.id" class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">原始输入</dt>
              <dd class="font-mono">{{ selectedEntry.original }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>行政区划数据更新至 {{ areaUpdatedAt }}</span>
      <span class="order-last w-full text-center sm:order-none sm:w-auto sm:flex-1" :class="status ? 'text-foreground' : ''">
        {{ status }}
      </span>
      <span>共 {{ stats.total }} · 有效 {{ stats.valid }} · 无效 {{ stats.invalid }}</span>
    </div>

    <!-- 批量生成弹窗 -->
    <Teleport to="body">
      <div
        v-if="showGenerate"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        @click.self="showGenerate = false"
      >
        <div class="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg">
          <h3 class="mb-4 text-base font-semibold">批量生成身份证号</h3>
          <div class="space-y-3 text-sm">
            <label class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-muted-foreground">数量</span>
              <input
                v-model.number="genCount"
                type="number"
                min="1"
                max="500"
                class="h-8 w-full rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-muted-foreground">性别</span>
              <select
                v-model="genSex"
                class="h-8 w-full rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">随机</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </label>
            <label class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-muted-foreground">年龄</span>
              <div class="flex flex-1 items-center gap-2">
                <input
                  v-model="genMinAge"
                  type="number"
                  placeholder="最小"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span class="text-muted-foreground">-</span>
                <input
                  v-model="genMaxAge"
                  type="number"
                  placeholder="最大"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </label>
            <label class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-muted-foreground">地区</span>
              <AreaCascader v-model="genArea" />
            </label>
          </div>
          <div class="mt-5 flex items-center justify-end gap-2">
            <button
              class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
              @click="showGenerate = false"
            >
              取消
            </button>
            <button
              class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
              @click="handleGenerate"
            >
              生成
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>