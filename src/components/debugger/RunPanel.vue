<script setup lang="ts">
import type { ApiRequest } from '@/lib/debugger/model'
import { buildRequest } from '@/lib/debugger/builder'
import { collectSnippet, extractPlaceholders, resolveVars } from '@/lib/debugger/variables'
import { parseResponse, inferParse } from '@/lib/debugger/parse'
import type { ParseResult } from '@/lib/debugger/parse'
import { effectivePaging, pagingParams } from '@/lib/debugger/paging'
import { pushHistory, type HistoryEntry } from '@/lib/debugger/db'
import { computed, onUnmounted, ref, watch } from 'vue'
import HistoryPanel from './HistoryPanel.vue'

const props = defineProps<{ api: ApiRequest; globals: Record<string, string>; sendTick?: number; picked: HistoryEntry | null }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
  (e: 'sent'): void // 发送完成后通知父级刷新左侧历史记录
}>()

const globals = computed(() => props.globals)
const running = ref(false)
// 发送成功后用该响应同步页码；响应展示统一走「所选历史」picked
const parsed = ref<ParseResult | null>(null)
const err = ref('')
const timeoutMs = 30000
const literalVar = '{{var}}'
const page = ref(1)

// 分页（含旧数据兼容：模板含 page 变量视为分页开启）
const effPaging = computed(() => effectivePaging(props.api))

// 模块/组件作用域的当前 AbortController：卸载时中止未完成的 fetch
let aborter: AbortController | null = null
onUnmounted(() => aborter?.abort())

// 外部「发送」信号（来自「请求」页 URL 右侧）：信号递增即触发一次发送
const lastSendTick = ref(props.sendTick ?? 0)
watch(() => props.sendTick, (v) => {
  if (v !== undefined && v !== lastSendTick.value) {
    lastSendTick.value = v
    if (!running.value) void send()
  }
})

// 从模板自动提取占位符并合并到变量（不覆盖已有默认值/描述）
const varNames = computed(() => extractPlaceholders([collectSnippet(props.api)]))
watch(varNames, (names) => {
  const existing = new Map(props.api.variables.map((v) => [v.name, v]))
  const merged = names.map((n) => existing.get(n) ?? { name: n, value: '' })
  const changed = merged.length !== props.api.variables.length
    || merged.some((m, i) => m.name !== props.api.variables[i]?.name)
  if (changed) emit('update', { ...props.api, variables: merged })
}, { immediate: true })

const vars = computed(() => props.api.variables.map((v) => ({ name: v.name, value: v.value })))
const resolved = computed(() => resolveVars(vars.value, globals.value))

function setVar(i: number, value: string) {
  const vs = props.api.variables.map((v, idx) => (idx === i ? { ...v, value } : v))
  emit('update', { ...props.api, variables: vs })
}

// 当前发送所用变量（模板占位符 + 运行时变量），并注入分页参数
function effResolved(): Record<string, string> {
  const r = { ...resolved.value }
  if (props.api.variables.some((v) => v.name === 'page')) r.page = String(page.value)
  return r
}

function pagingOverrides(): Record<string, string> {
  return effPaging.value ? pagingParams(effPaging.value, page.value) : {}
}

async function send() {
  running.value = true
  err.value = ''
  parsed.value = null
  const log: string[] = []
  const t0 = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const overrides = pagingOverrides()
  const built = buildRequest(props.api, { ...effResolved(), ...overrides }, overrides)
  log.push(`* Preparing request to \`${built.url}\``)
  log.push(`* Current time is ${new Date().toISOString()}`)
  log.push('* Enable automatic URL encoding')
  log.push('* Using default HTTP version')
  log.push(`* Enable timeout of ${timeoutMs}ms`)
  if (Object.keys(overrides).length) log.push(`* Paging params: ${JSON.stringify(overrides)}`)
  try {
    let target: URL
    try { target = new URL(built.url) } catch { target = new URL('https://invalid.invalid/') }
    log.push('', `> ${built.method} ${target.pathname + target.search} HTTP/1.1`)
    log.push(`> Host: ${target.host}`)
    for (const [k, v] of built.headers) log.push(`> ${k}: ${v}`)
    if (built.body !== undefined) log.push(`> Content-Length: ${new Blob([built.body]).size}`)
    log.push('> Accept: */*')
    log.push('')
    const ctl = new AbortController()
    aborter = ctl
    timer = setTimeout(() => ctl.abort(), timeoutMs)
    const resp = await fetch(built.url, built.body !== undefined ? { method: built.method, headers: built.headers, body: built.body, signal: ctl.signal } : { method: built.method, headers: built.headers, signal: ctl.signal })
    const ms = Math.round(performance.now() - t0)
    clearTimeout(timer)
    const raw = await resp.text()
    const size = new Blob([raw]).size
    log.push('', `< HTTP/1.1 ${resp.status}${STATUS_REASON[resp.status] ? ' ' + STATUS_REASON[resp.status] : ''}`)
    log.push('* Connected via browser fetch（TLS / DNS 细节不对页面暴露）')
    log.push(`* Received ${size} B`)
    log.push('* Connection closed')
    const entry: HistoryEntry = { ts: Date.now(), status: resp.status, ms, size, raw, console: log.join('\n') }
    await pushHistory(props.api.id, entry)
    emit('sent')
    parsed.value = parseResponse(raw, props.api.parse)
    if (parsed.value?.page !== undefined) page.value = parsed.value.page
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    if (timer) clearTimeout(timer)
    const aborted = (e as Error).name === 'AbortError'
    const msg = aborted ? '请求超时' : '请求失败（多为 CORS 跨域限制或网络不可达）'
    log.push('', aborted ? `* Operation timed out after ${ms}ms` : `* Error: ${msg}`)
    const entry: HistoryEntry = { ts: Date.now(), status: undefined, ms, error: msg, console: log.join('\n') }
    await pushHistory(props.api.id, entry)
    emit('sent')
    err.value = '发送失败：' + msg
  } finally {
    running.value = false
  }
}

function goToPage(p: number) {
  const next = Math.max(1, p)
  if (next === page.value) return
  page.value = next
  void send()
}

// 「自动解析」：按当前选中（最新）历史的响应，一键推断 列表/总数/页码/字段列 并启用分页，无需切到「解析」页
function autoParse() {
  const src = props.picked
  if (!src?.raw) return
  const json = parseResponse(src.raw, props.api.parse).json
  if (!json) { window.alert('当前响应不是可推断的 JSON，无法自动解析'); return }
  const inf = inferParse(json)
  if (!inf) { window.alert('未在响应中找到列表数组，请手动填写 JSONPath'); return }
  emit('update', {
    ...props.api,
    parse: { ...props.api.parse, listPath: inf.parse.listPath!, totalPath: inf.parse.totalPath, pagePath: inf.parse.pagePath, columns: inf.parse.columns },
    paging: { ...props.api.paging, ...inf.paging, enabled: true },
  })
}

// 当前选中历史的解析结果，供分页器与总数展示
const displayParsed = computed<ParseResult | null>(() => props.picked?.raw ? parseResponse(props.picked.raw, props.api.parse) : null)

const STATUS_REASON: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  418: "I'm a Teapot", 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported',
}
</script>

<template>
  <div class="space-y-4">
    <!-- 发送区 -->
    <div class="httpd-panel">
      <div class="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <span class="httpd-eyebrow text-muted-foreground">发送请求</span>
        <span v-if="effPaging" class="font-mono text-[10px] text-muted-foreground">
          分页：{{ effPaging.mode === 'offset' ? `${effPaging.sizeParam}/${effPaging.offsetParam}` : `${effPaging.pageParam}/${effPaging.sizeParam}` }} · 每页 {{ effPaging.size }} 条
        </span>
        <span class="ml-auto">
          <button class="rounded border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-accent disabled:opacity-40" :disabled="running" :title="'按当前接口发送请求并记录到历史；若配置了分页，将携带分页参数'" @click="send">
            {{ running ? '发送中…' : '🚀 发送' }}
          </button>
        </span>
      </div>
      <div class="space-y-2 p-3">
        <div v-if="vars.length" class="grid gap-2 md:grid-cols-2">
          <label v-for="(v, i) in vars" :key="v.name" class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-muted-foreground">{{ v.name }}</span>
            <input class="rounded border border-border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :value="v.value" :placeholder="globals[props.api.variables[i]?.name ?? v.name] !== undefined ? `默认 ${globals[props.api.variables[i]?.name ?? v.name]}` : ''"
              @input="setVar(i, ($event.target as HTMLInputElement).value)" />
          </label>
        </div>
        <p v-if="!vars.length" class="text-xs text-muted-foreground">模板中没有 {{ literalVar }} 占位符，可直接点击上方「🚀 发送」。</p>
      </div>
    </div>

    <div v-if="err" class="rounded border-l-2 border-l-destructive border-border bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
      <span class="font-bold">! 错误 · </span>{{ err }}
    </div>

    <div v-if="picked" class="httpd-panel">
      <!-- 分页器（配置了分页风格且能解析出列表时显示） -->
      <div v-if="effPaging && displayParsed?.rows?.length" class="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <button title="上一页" class="httpd-btn rounded border border-border px-2.5 py-0.5 text-muted-foreground hover:bg-accent disabled:opacity-40" :disabled="running || page <= 1" @click="goToPage(page - 1)">‹ 上一页</button>
        <span class="flex items-center gap-1 font-mono text-muted-foreground">
          页码
          <input type="number" min="1" :value="page" :disabled="running" title="跳到指定页码"
            class="w-14 rounded border border-border bg-background px-1 py-0.5 text-center font-mono"
            @change="goToPage(Number(($event.target as HTMLInputElement).value) || 1)" />
        </span>
        <button title="下一页" class="httpd-btn rounded border border-border px-2.5 py-0.5 text-muted-foreground hover:bg-accent disabled:opacity-40" :disabled="running" @click="goToPage(page + 1)">下一页 ›</button>
        <span v-if="displayParsed.total !== undefined" class="ml-auto font-mono text-muted-foreground">共 {{ displayParsed.total }} 条</span>
      </div>

      <HistoryPanel :entry="picked" :parse="props.api.parse" :columns="props.api.parse.columns" default-view="list">
        <template #actions>
          <button
            class="ml-2 shrink-0 rounded border border-border px-2 py-0.5 text-xs font-semibold text-primary hover:bg-accent"
            :disabled="!picked.raw"
            title="按当前响应的响应体自动推断 列表 / 总数 / 页码 / 字段列，并启用分页"
            @click="autoParse">✨ 自动解析</button>
        </template>
      </HistoryPanel>
    </div>
  </div>
</template>