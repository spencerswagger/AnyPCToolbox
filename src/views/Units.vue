<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipPortal, TooltipContent } from 'radix-vue'
import { Copy } from 'lucide-vue-next'
import { tokenize, type Token } from '@/lib/units/lexer'
import { directRatio, equivalentsFor, formatValue, mergeTokens, type EquivResult, type Equivalent } from '@/lib/units/convert'
import { allCurrencyCodes, COMMON_CURRENCIES, CURRENCY_SYMBOLS } from '@/lib/units/money'
import { ALIASES, DIMS, UNITS, type Dim, type UnitDef } from '@/lib/units/registry'
import { loadInitialRates, onRatesUpdate, refreshRatesOnline, RATE_PROVIDER_NAME, RATE_PROVIDER_URL, type RateState } from '@/lib/units/rates'

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
const entries = computed<Entry[]>(() => {
  const merged = mergeTokens(tokens.value, rateState.value?.rates ?? null)
  return merged.map((token) => ({ token, result: equivalentsFor(token, rateState.value?.rates ?? null) }))
})
const recognizedCount = computed(() => entries.value.filter((e) => e.token.dim !== undefined).length)
const unrecognizedCount = computed(() => entries.value.filter((e) => e.token.dim === undefined).length)

// ---- 单位匹配与换算规则详表（折叠，默认收起） ----
const showRules = ref(false)

/** 默认展示条数，超过的部分点击展开 */
const MAX_SHOW = 10

// 片段结果展开态（按结果卡片下标）
const expandedEntries = ref<number[]>([])
// 规则详表展开态（按量纲）
const expandedSections = ref<Dim[]>([])

function isExpandable(e: Entry): boolean {
  return e.result?.dim === 'currency' && (e.result?.equivalents.length ?? 0) > MAX_SHOW
}
function isExpanded(i: number): boolean {
  return expandedEntries.value.includes(i)
}
function visibleEquivs(e: Entry, i: number): Equivalent[] {
  const list = e.result?.equivalents ?? []
  if (!isExpandable(e) || isExpanded(i)) return list
  return list.slice(0, MAX_SHOW)
}
function toggleExpand(i: number): void {
  const arr = expandedEntries.value
  expandedEntries.value = arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]
}

function visibleRefUnits(s: RefSection): RefUnit[] {
  if (s.units.length <= MAX_SHOW || expandedSections.value.includes(s.id)) return s.units
  return s.units.slice(0, MAX_SHOW)
}
function toggleRefSection(id: Dim): void {
  const arr = expandedSections.value
  expandedSections.value = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
}

interface RefUnit {
  canonical: string
  name: string
  aliases: string
  rule: string
}
interface RefSection {
  id: Dim
  label: string
  base: string
  units: RefUnit[]
}

function fmtFactor(f: number): string {
  return String(Number(f.toPrecision(6)))
}

function aliasesOf(canonical: string): string {
  return Object.keys(ALIASES)
    .filter((k) => ALIASES[k].canonical === canonical)
    .join('、')
}

function unitRule(u: UnitDef, base: string): string {
  if (u.factor !== undefined) return u.factor === 1 ? '基准单位' : `1 ${u.canonical} = ${fmtFactor(u.factor)} ${base}`
  if (u.canonical === '℃') return '基准单位'
  if (u.canonical === '℉') return '℃ = (℉ − 32) × 5/9'
  return '℃ = K − 273.15'
}

const referenceSections = computed<RefSection[]>(() =>
  DIMS.map((d) => {
    if (d.id === 'currency') {
      const units: RefUnit[] = allCurrencyCodes(rateState.value?.rates ?? null).map((code) => {
        const info = COMMON_CURRENCIES.find((c) => c.code === code)
        const sym = CURRENCY_SYMBOLS.find((s) => s.code === code)
        const names = Object.keys(ALIASES).filter(
          (k) => ALIASES[k].dim === 'currency' && ALIASES[k].canonical === code && !/^[A-Za-z]{3}$/.test(k),
        )
        const aliases = [...(sym ? [sym.symbols] : []), ...names].join('、')
        return { canonical: code, name: info?.name ?? code, aliases, rule: '汇率换算（基准 USD）' }
      })
      return { id: d.id, label: d.label, base: d.base, units }
    }
    const units: RefUnit[] = UNITS[d.id].map((u) => ({
      canonical: u.canonical,
      name: u.name,
      aliases: aliasesOf(u.canonical),
      rule: unitRule(u, d.base),
    }))
    return { id: d.id, label: d.label, base: d.base, units }
  }),
)

// ---- 主换算 ----
function handleConvert(): void {
  tokens.value = tokenize(input.value)
  const n = tokens.value.length
  if (n === 0) {
    toast(undefined, '未识别到数值，请输入如 30kg 或 $1.99')
    return
  }
  if (unrecognizedCount.value === entries.value.length) toast(undefined, `无法识别 ${unrecognizedCount.value} 个片段`)
}

async function copyValue(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(undefined, `已复制 ${text}`)
  } catch {
    toast(undefined, '复制失败')
  }
}

// ---- 悬停 tooltip：直接换算规则 ----
const TEMP_FORMULA: Record<string, Record<string, string>> = {
  '℃': { '℉': '℉ = ℃ × 9/5 + 32', K: 'K = ℃ + 273.15' },
  '℉': { '℃': '℃ = (℉ − 32) × 5/9', K: 'K = (℉ + 459.67) × 5/9' },
  K: { '℃': '℃ = K − 273.15', '℉': '℉ = K × 9/5 − 459.67' },
}

function directRule(e: Entry, eq: Equivalent): string[] {
  if (eq.noRate) return ['无汇率数据']
  const t = e.token
  // 合并项：逐片段给出 1 单位到悬停目标的直接换算比率，同单位跳过
  if (t.merged && t.parts?.length) {
    const dim = e.result?.dim
    const rates = rateState.value?.rates ?? null
    const lines: string[] = []
    if (dim) {
      for (const p of t.parts) {
        if (p.unit === eq.unit) continue
        const ratio = directRatio(p.unit, eq.unit, dim, rates)
        if (ratio === undefined) continue
        lines.push(`1 ${p.unit} = ${formatValue(ratio)} ${eq.unit}`)
      }
    }
    return lines
  }
  const src = t.unit ?? ''
  if (e.result?.dim === 'temperature') {
    const f = TEMP_FORMULA[src]?.[eq.unit]
    return [f ? `公式：${f}` : '基准单位']
  }
  const v = t.value
  if (v === undefined) return [`1 ${src} = ${formatValue(eq.value)} ${eq.unit}`]
  if (v === 0) return [`0 ${src} = ${formatValue(eq.value)} ${eq.unit}`]
  return [`1 ${src} = ${formatValue(eq.value / v)} ${eq.unit}`]
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

function sourceHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
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
            >片段：{{ e.token.raw }}<template v-if="e.token.unit && !e.token.merged"> {{ e.token.unit }}</template></span
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
        <div v-else class="grid gap-2 p-4 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          <TooltipRoot v-for="eq in visibleEquivs(e, i)" :key="eq.unit">
            <TooltipTrigger as-child>
              <div
                class="flex cursor-default items-center gap-2 rounded-md border bg-card/50 px-3 py-2 text-sm"
              >
                <span class="min-w-0 flex-none text-muted-foreground">{{ eq.name }}（{{ eq.unit }}）</span>
                <span v-if="eq.noRate" class="shrink-0 text-xs text-muted-foreground">无汇率数据</span>
                <span v-else class="min-w-0 flex-1 break-words text-right font-mono">{{ formatValue(eq.value) }}</span>
                <span v-if="eq.approx" class="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">近似</span>
                <button
                  v-if="!eq.noRate"
                  class="shrink-0 rounded p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  @click="copyValue(formatValue(eq.value))"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="bottom"
                class="z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
              >
                <div class="space-y-0.5">
                  <p v-for="(line, li) in directRule(e, eq)" :key="li">{{ line }}</p>
                </div>
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </div>
        <button
          v-if="isExpandable(e)"
          class="block w-full border-t px-4 py-2 text-xs text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @click="toggleExpand(i)"
        >
          {{ isExpanded(i) ? '收起' : `展开全部 ${e.result?.equivalents.length ?? 0} 种币种` }}
        </button>
        <div v-if="e.result?.note" class="border-t px-4 py-2 text-xs text-muted-foreground">
          {{ e.result.note }}
        </div>
      </div>
    </div>
    <div v-else-if="input && tokens.length === 0" class="py-8 text-center text-sm text-muted-foreground">
      未识别到数值片段
    </div>

    <!-- 单位匹配与换算规则详表（折叠，默认收起） -->
    <div class="rounded-lg border">
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="showRules = !showRules"
      >
        单位匹配与换算规则
        <span class="text-muted-foreground">{{ showRules ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showRules" class="border-t p-4 text-sm">
        <div v-for="s in referenceSections" :key="s.id" class="mb-6 last:mb-0">
          <h3 class="mb-2 font-semibold">{{ s.label }}（基准单位：{{ s.base }}）</h3>
          <div class="overflow-x-auto">
            <table class="w-full border rounded-md">
              <thead>
                <tr class="bg-muted/50">
                  <th class="border p-2 text-left text-xs">单位符号</th>
                  <th class="border p-2 text-left text-xs">单位名称</th>
                  <th class="border p-2 text-left text-xs">别名</th>
                  <th class="border p-2 text-left text-xs">换算规则</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in visibleRefUnits(s)" :key="u.canonical" class="hover:bg-muted/50">
                  <td class="border p-2 font-mono">{{ u.canonical }}</td>
                  <td class="border p-2">{{ u.name }}</td>
                  <td class="border p-2 max-w-xs truncate">{{ u.aliases }}</td>
                  <td class="border p-2 font-mono text-xs">{{ u.rule }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            v-if="s.units.length > MAX_SHOW"
            class="mt-2 flex w-full items-center justify-center rounded-md border py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            @click="toggleRefSection(s.id)"
          >
            {{ expandedSections.includes(s.id) ? '收起' : `展开全部 ${s.units.length} 种` }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <div v-if="rateState" class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="flex items-center gap-1">
          汇率来源：
          <a
            :href="RATE_PROVIDER_URL"
            target="_blank"
            rel="noreferrer"
            class="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {{ RATE_PROVIDER_NAME }}
          </a>
          <span v-if="rateState.rates._source" class="font-mono">（{{ sourceHost(rateState.rates._source) }}）</span>
        </span>
        <span>每日更新，非实时</span>
        <span>数据：{{ rateState.source }}</span>
        <span v-if="formatDate(rateState.rates._updatedAt)">更新于 {{ formatDate(rateState.rates._updatedAt) }}</span>
      </div>
      <span v-else>汇率加载中…</span>
      <span>识别 {{ recognizedCount }} 段 · 无法识别 {{ unrecognizedCount }} 段</span>
    </div>
  </div>
  </TooltipProvider>
</template>
