<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'radix-vue'
import { tokenize, type Token } from '@/lib/units/lexer'
import { equivalentsFor, formatValue, type EquivResult } from '@/lib/units/convert'
import { COMMON_CURRENCIES, CURRENCY_SYMBOLS } from '@/lib/units/money'
import { DIMS, UNITS, type Dim } from '@/lib/units/registry'
import { loadInitialRates, onRatesUpdate, refreshRatesOnline, type RateState } from '@/lib/units/rates'

const router = useRouter()
const { toast } = useToaster()

const input = ref('')
const tokens = ref<Token[]>([])
const rateState = ref<RateState | null>(null)

// ---- 结果 ----
interface Entry {
  token: Token
  result: EquivResult | null
}
const entries = computed<Entry[]>(() =>
  tokens.value.map((token) => ({ token, result: equivalentsFor(token, rateState.value?.rates ?? null) })),
)
const recognizedCount = computed(() => tokens.value.filter((t) => t.dim !== undefined).length)
const unrecognizedCount = computed(() => tokens.value.length - recognizedCount.value)

// ---- 手动换算 ----
const showManual = ref(false)
const manualDim = ref<Dim>('length')
const manualFrom = ref('')
const manualTo = ref('')
const manualValue = ref('')
const manualResult = ref<string | null>(null)
const PREFS_KEY = 'units:pref'

function unitsOf(dim: Dim): Array<{ code: string; name: string }> {
  if (dim === 'currency') return COMMON_CURRENCIES
  return UNITS[dim].map((u) => ({ code: u.canonical, name: u.name }))
}

function syncManualUnits(): void {
  const list = unitsOf(manualDim.value)
  if (!list.some((u) => u.code === manualFrom.value)) manualFrom.value = list[0]?.code ?? ''
  if (!list.some((u) => u.code === manualTo.value)) manualTo.value = list[1]?.code ?? list[0]?.code ?? ''
}

function loadPrefs(): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const p = JSON.parse(raw) as { dim?: Dim; from?: string; to?: string }
    if (p.dim && DIMS.some((d) => d.id === p.dim)) manualDim.value = p.dim
    if (typeof p.from === 'string') manualFrom.value = p.from
    if (typeof p.to === 'string') manualTo.value = p.to
  } catch {
    // 解析失败 → 默认偏好
  }
  syncManualUnits()
}

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ dim: manualDim.value, from: manualFrom.value, to: manualTo.value }))
  } catch {
    // 存储失败静默
  }
}

watch([manualDim, manualFrom, manualTo], () => {
  syncManualUnits()
  savePrefs()
})

function handleManualConvert(): void {
  const raw = manualValue.value.trim()
  const v = Number(raw)
  if (!raw || Number.isNaN(v)) {
    manualResult.value = null
    toast(undefined, '请输入数值')
    return
  }
  if (!manualFrom.value || !manualTo.value) {
    manualResult.value = null
    toast(undefined, '请选择源单位与目标单位')
    return
  }
  const tok: Token = { raw: `${v} ${manualFrom.value}`, value: v, unit: manualFrom.value, dim: manualDim.value }
  const res = equivalentsFor(tok, rateState.value?.rates ?? null)
  const eq = res?.equivalents.find((e) => e.unit === manualTo.value)
  if (!eq) {
    manualResult.value = null
    toast(undefined, '该量纲不支持此换算')
    return
  }
  manualResult.value = formatValue(eq.value)
}

// ---- 主换算 ----
function handleConvert(): void {
  tokens.value = tokenize(input.value)
  const n = tokens.value.length
  if (n === 0) {
    toast(undefined, '未识别到数值，请输入如 30kg 或 $1.99')
    return
  }
  if (unrecognizedCount.value === n) toast(undefined, `无法识别 ${n} 个片段`)
}

async function copyValue(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(undefined, `已复制 ${text}`)
  } catch {
    toast(undefined, '复制失败')
  }
}

// ---- 汇率链 ----
let offRates: (() => void) | null = null
onMounted(() => {
  void loadInitialRates().then((s) => {
    rateState.value = s
  })
  offRates = onRatesUpdate((s) => {
    rateState.value = s
  })
  void refreshRatesOnline()
})
onBeforeUnmount(() => {
  offRates?.()
})

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

loadPrefs()
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
      <h2 class="text-lg font-semibold">单位换算</h2>
      <div class="ml-auto">
        <TooltipProvider>
          <TooltipRoot>
            <TooltipTrigger as-child>
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-input text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
              >
                ?
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="bottom"
                align="end"
                class="z-50 max-w-xs rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-lg"
              >
                <p class="mb-2 font-medium">货币符号对照表</p>
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-muted-foreground">
                      <th class="pb-1 text-left font-normal">符号</th>
                      <th class="pb-1 text-left font-normal">币种</th>
                      <th class="pb-1 text-left font-normal">代码</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in CURRENCY_SYMBOLS" :key="c.code" class="border-t border-border/50">
                      <td class="py-0.5 pr-2 font-mono">{{ c.symbols }}</td>
                      <td class="py-0.5 pr-2">{{ c.name }}</td>
                      <td class="py-0.5 font-mono">{{ c.code }}</td>
                    </tr>
                  </tbody>
                </table>
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </TooltipProvider>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="mx-auto max-w-2xl pt-2">
      <div class="relative">
        <input
          v-model="input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="如 30kg 和 $1.99，回车换算"
          class="block w-full rounded-2xl bg-accent/60 py-3 pl-4 pr-24 text-sm font-mono outline-none placeholder:text-muted-foreground focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter.prevent="handleConvert"
        />
        <button
          class="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="handleConvert"
        >
          换算
        </button>
      </div>
      <p class="mt-2 text-center text-xs text-muted-foreground">支持多个片段，如 "30kg 和 $1.99"</p>
    </div>

    <!-- 结果区 -->
    <div v-if="entries.length" class="space-y-4">
      <div v-for="(e, i) in entries" :key="i" class="rounded-lg border">
        <div class="flex items-center gap-2 border-b px-3 py-2">
          <span class="text-sm font-semibold"
            >片段：{{ e.token.raw }}<template v-if="e.token.unit"> {{ e.token.unit }}</template></span
          >
          <span
            v-if="e.result"
            class="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >{{ e.result.dimLabel }}</span
          >
          <span v-if="e.token.symbol" class="ml-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground"
            >{{ e.token.symbol }} 前置符号</span
          >
        </div>

        <div v-if="e.token.error" class="px-4 py-3 text-sm text-muted-foreground">
          ⚠️ 无法识别片段：{{ e.token.error }}
        </div>
        <div v-else-if="!e.token.unit" class="px-4 py-3 text-sm text-muted-foreground">
          未识别到单位：{{ e.token.value }}
        </div>
        <div v-else-if="!e.result" class="px-4 py-3 text-sm text-muted-foreground">
          暂不支持该量纲换算
        </div>
        <ul v-else class="divide-y">
          <li v-for="eq in e.result.equivalents" :key="eq.unit" class="flex items-center gap-2 px-4 py-2 text-sm">
            <span class="w-40 shrink-0 text-muted-foreground">{{ eq.name }}（{{ eq.unit }}）</span>
            <span v-if="eq.noRate" class="text-muted-foreground">无汇率数据</span>
            <span v-else class="font-mono">{{ formatValue(eq.value) }}</span>
            <span v-if="eq.approx" class="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">近似</span>
            <button
              v-if="!eq.noRate"
              class="ml-auto shrink-0 rounded px-2 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              @click="copyValue(formatValue(eq.value))"
            >
              复制
            </button>
          </li>
        </ul>
        <div v-if="e.result?.note" class="border-t px-4 py-2 text-xs text-muted-foreground">
          {{ e.result.note }}
        </div>
      </div>
    </div>
    <div v-else-if="input && tokens.length === 0" class="py-8 text-center text-sm text-muted-foreground">
      未识别到数值片段
    </div>

    <!-- 手动选择表（折叠，默认收起） -->
    <div class="rounded-lg border">
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="showManual = !showManual"
      >
        手动选择换算
        <span class="text-muted-foreground">{{ showManual ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showManual" class="space-y-3 border-t px-4 py-4 text-sm">
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">量纲</span>
            <select
              v-model="manualDim"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="d in DIMS" :key="d.id" :value="d.id">{{ d.label }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">源单位</span>
            <select
              v-model="manualFrom"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="u in unitsOf(manualDim)" :key="u.code" :value="u.code">{{ u.name }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">目标</span>
            <select
              v-model="manualTo"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="u in unitsOf(manualDim)" :key="u.code" :value="u.code">{{ u.name }}</option>
            </select>
          </label>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="manualValue"
            type="text"
            inputmode="decimal"
            spellcheck="false"
            placeholder="数值"
            class="h-8 w-32 rounded-md border border-input bg-background px-2 font-mono outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            @keydown.enter.prevent="handleManualConvert"
          />
          <span class="text-muted-foreground">=</span>
          <span v-if="manualResult !== null" class="font-mono text-primary">{{ manualResult }} {{ manualTo }}</span>
          <span v-else class="text-muted-foreground">—</span>
          <button
            class="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            @click="handleManualConvert"
          >
            换算
          </button>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="rateState"
        >汇率：{{ rateState.source
        }}<template v-if="formatDate(rateState.rates._updatedAt)"> · {{ formatDate(rateState.rates._updatedAt) }}</template></span
      >
      <span v-else>汇率加载中…</span>
      <span>识别 {{ recognizedCount }} 段 · 无法识别 {{ unrecognizedCount }} 段</span>
    </div>
  </div>
</template>
