<script setup lang="ts">
import type { ApiRequest } from '@/lib/debugger/model'
import { buildRequest } from '@/lib/debugger/builder'
import { collectSnippet, extractPlaceholders, resolveVars } from '@/lib/debugger/variables'
import { parseResponse } from '@/lib/debugger/parse'
import type { ParseResult } from '@/lib/debugger/parse'
import { getGlobals, pushHistory } from '@/lib/debugger/db'
import { computed, onMounted, ref, watch } from 'vue'
import ResponseTable from './ResponseTable.vue'

const props = defineProps<{ api: ApiRequest }>()
const emit = defineEmits<{ (e: 'update', api: ApiRequest): void }>()

const globals = ref<Record<string, string>>({})
const running = ref(false)
const result = ref<{ ok: boolean; status?: number; ms?: number; size?: number; raw: string } | null>(null)
const parsed = ref<ParseResult | null>(null)
const err = ref('')
const view = ref<'raw' | 'table'>('raw')
const timeoutMs = 30000
const literalVar = '{{var}}'
const pageSize = 10
const page = ref(1)

onMounted(async () => { globals.value = await getGlobals() })

// 从模板自动提取占位符并合并到变量（不覆盖已有默认值/描述）
const varNames = computed(() => extractPlaceholders([collectSnippet(props.api)]))
watch(varNames, (names) => {
  const existing = new Map(props.api.variables.map((v) => [v.name, v]))
  const merged = names.map((n) => existing.get(n) ?? { name: n, value: '' })
  emit('update', { ...props.api, variables: merged })
}, { immediate: true })

const vars = computed(() => props.api.variables.map((v) => ({ name: v.name, value: v.value })))
const resolved = computed(() => resolveVars(vars.value, globals.value))

function setVar(i: number, value: string) {
  const vs = props.api.variables.map((v, idx) => (idx === i ? { ...v, value } : v))
  emit('update', { ...props.api, variables: vs })
}

// 分页：始终用 page 覆盖模板里的 {{page}}（若有），重发拿到目标页
function effResolved(): Record<string, string> {
  const r = { ...resolved.value }
  if (props.api.variables.some((v) => v.name === 'page')) r.page = String(page.value)
  return r
}

function goToPage(p: number) {
  page.value = p
  void send()
}

async function send() {
  running.value = true
  err.value = ''
  result.value = null
  parsed.value = null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const built = buildRequest(props.api, effResolved())
    const ctl = new AbortController()
    timer = setTimeout(() => ctl.abort(), timeoutMs)
    const t0 = performance.now()
    const resp = await fetch(built.url, built.body !== undefined ? { method: built.method, headers: built.headers, body: built.body, signal: ctl.signal } : { method: built.method, headers: built.headers, signal: ctl.signal })
    const ms = Math.round(performance.now() - t0)
    const raw = await resp.text()
    clearTimeout(timer)
    const size = new Blob([raw]).size
    const entry = { ts: Date.now(), status: resp.status, ms, size, raw }
    void pushHistory(props.api.id, entry)
    result.value = { ok: resp.ok, status: resp.status, ms, size, raw }
    parsed.value = parseResponse(raw, props.api.parse)
    page.value = parsed.value?.page ?? 1
  } catch (e) {
    if (timer) clearTimeout(timer)
    err.value = '发送失败：' + ((e as Error).name === 'AbortError' ? '请求超时' : '多为 CORS 跨域限制或网络不可达')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 变量表单 -->
    <div class="rounded-lg border border-border p-3">
      <div class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">变量{{ Object.keys(resolved).length ? `（${Object.keys(resolved).length}）` : '' }}</div>
      <div v-if="vars.length" class="grid gap-2 md:grid-cols-2">
        <label v-for="(v, i) in vars" :key="v.name" class="flex flex-col gap-1">
          <span class="text-xs font-mono text-muted-foreground">{{ v.name }}</span>
          <input class="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :value="v.value" :placeholder="globals[props.api.variables[i]?.name ?? v.name] !== undefined ? `默认 ${globals[props.api.variables[i]?.name ?? v.name]}` : ''"
            @input="setVar(i, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
      <p v-else class="text-sm text-muted-foreground">模板中没有 {{ literalVar }} 占位符，可直接发送。</p>
      <div class="mt-3 flex items-center gap-3">
        <button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60" :disabled="running" @click="send">{{ running ? '发送中…' : '发送' }}</button>
        <label v-if="props.api.variables.some((v) => v.name === 'page')" class="flex items-center gap-1.5 text-sm text-muted-foreground">
          当前页
          <input type="number" min="1" class="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :value="page" @change="goToPage(Number(($event.target as HTMLInputElement).value) || 1)" />
        </label>
      </div>
    </div>

    <div v-if="err" class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ {{ err }}</div>

    <div v-if="result" class="rounded-lg border border-border">
      <div class="flex items-center gap-3 border-b border-border px-3 py-2 text-sm">
        <span class="font-semibold" :class="result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'">{{ result.status }}</span>
        <span class="text-muted-foreground">{{ result.ms }}ms</span>
        <span class="text-muted-foreground">{{ result.size }} B</span>
        <div class="ml-auto flex gap-1">
          <button class="rounded-md px-2 py-1 text-xs" :class="view === 'raw' ? 'bg-accent' : 'hover:bg-accent'" @click="view='raw'">原始</button>
          <button class="rounded-md px-2 py-1 text-xs" :class="view === 'table' ? 'bg-accent' : 'hover:bg-accent'" @click="view='table'">表格</button>
        </div>
      </div>
      <pre v-if="view === 'raw'" class="max-h-[60vh] overflow-auto p-3 font-mono text-xs">{{ result.raw }}</pre>
      <div v-else-if="parsed && !parsed.ok" class="p-3 text-sm text-muted-foreground">
        {{ parsed.error }}<span v-if="parsed.topKeys?.length">；顶层键：{{ parsed.topKeys.join(', ') }}</span>
      </div>
      <ResponseTable v-else-if="parsed && parsed.rows.length" :rows="parsed.rows" :total="parsed.total" :page="page" :page-size="pageSize" :columns="props.api.parse.columns" :loading="running" @go="goToPage" />
    </div>
  </div>
</template>