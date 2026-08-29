<script setup lang="ts">
import type { HistoryEntry } from '@/lib/debugger/db'
import type { ColumnDef, ParseConfig } from '@/lib/debugger/model'
import { parseResponse } from '@/lib/debugger/parse'
import { computed, ref, watch } from 'vue'
import { TooltipProvider } from 'radix-vue'
import ResponseTable from './ResponseTable.vue'
import JsonTree from './JsonTree.vue'

const props = withDefaults(defineProps<{
  entry: HistoryEntry | null
  parse: ParseConfig
  columns: ColumnDef[]
  // 默认激活的标签：'list' 表示“能解析成列表就切到列表，否则切到 JSON”（供「调试」页使用）
  defaultView?: 'console' | 'json' | 'list'
}>(), { defaultView: 'console' })

type ViewName = 'console' | 'json' | 'list'

type Line = { t: string; c: string }
// 将 console 文本拆为带行级配色的行（模仿 curl 的 * / > / < 语义）
function consoleLines(text: string): Line[] {
  return text.split('\n').map((l) => {
    const s = l.trimStart()
    if (s.startsWith('>')) return { t: l, c: 'ln-req' }
    if (s.startsWith('<')) return { t: l, c: 'ln-res' }
    if (/error|timed out|timeout/i.test(l)) return { t: l, c: 'ln-err' }
    return { t: l, c: 'ln-ack' }
  })
}
function sCls(status?: number): string {
  if (!status || status < 100 || status >= 600) return 'httpd-ser'
  return `httpd-s${Math.floor(status / 100)}`
}

// 响应体是否解析为 JSON 树（JSON 视图用交互式树展示）
const jsonValue = computed<unknown | null>(() => {
  const raw = props.entry?.raw ?? ''
  try { return JSON.parse(raw) } catch { return null }
})
// 本地下钻得取的列表路径（在 JSON 树 / 对象「查看」里选中的数组），用于递归查看嵌套列表
const localPath = ref<string | null>(null)
const effParse = computed<ParseConfig>(() => ({ ...props.parse, listPath: localPath.value ?? props.parse.listPath }))
// 响应体是否能解析为列表 → 「列表」标签可用
const canList = computed(() => {
  if (!props.entry?.raw) return false
  return parseResponse(props.entry.raw, effParse.value).rows.length > 0
})
// 点击 JSON 树里的「设为列表」→ 下钻到该数组并切到「列表」视图
function pickList(path: string) {
  if (!path) return
  localPath.value = path
  view.value = 'list'
}
function listRows(): unknown[] {
  if (!props.entry?.raw) return []
  return parseResponse(props.entry.raw, effParse.value).rows
}
// 依据默认标签决定初始激活哪个视图：默认 list 时“能解析成列表→列表，否则→JSON”
function initialView(): ViewName {
  if (props.defaultView === 'list') {
    const raw = props.entry?.raw ?? ''
    return raw && parseResponse(raw, props.parse).rows.length > 0 ? 'list' : 'json'
  }
  return props.defaultView
}
const view = ref<ViewName>(initialView())
// 换了一条历史（发送产生新记录 / 点了别的时间点）→ 回到默认标签
watch(() => props.entry?.ts, () => { view.value = initialView() })

const viewOpts = [
  { k: 'console' as const, label: '控制台', title: '完整的请求 / 响应收发过程日志' },
  { k: 'json' as const, label: 'JSON', title: '响应体的原始 JSON 或文本' },
  { k: 'list' as const, label: '列表', title: '按解析规则渲染为列表表格（需已配置并匹配到列表）' },
]
</script>

<template>
  <TooltipProvider v-if="entry" :delay-duration="120">
    <div class="httpd-panel">
      <div class="httpd-panel-title">
      <span class="httpd-eyebrow text-muted-foreground">请求记录</span>
      <span class="httpd-pill" :class="sCls(entry.status)">{{ entry.status ?? 'ERR' }}</span>
      <span class="font-mono text-muted-foreground">{{ new Date(entry.ts).toLocaleString() }}</span>
      <slot name="actions" />
      <span class="ml-auto flex gap-1">
        <button
          v-for="o in viewOpts" :key="o.k"
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="view === o.k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'"
          :disabled="o.k === 'list' && !canList"
          :title="o.title + (o.k === 'list' && !canList ? '（未匹配到列表，不可用）' : '')"
          @click="view = o.k"
        >{{ o.label }}</button>
      </span>
    </div>
    <div v-if="view === 'console'" class="httpd-console max-h-[50vh] overflow-auto p-3">
      <span v-for="(ln, i) in consoleLines(entry.console)" :key="i" :class="ln.c" class="block whitespace-pre">{{ ln.t }}</span>
    </div>
    <div v-else-if="view === 'json'" class="httpd-console max-h-[50vh] overflow-auto">
      <JsonTree v-if="jsonValue !== null" :value="jsonValue" :pickable="true" max-height-class="" @pick="pickList" />
      <pre v-else class="whitespace-pre-wrap p-3 font-mono text-xs text-foreground">{{ entry.raw }}</pre>
    </div>
    <div v-else class="httpd-console max-h-[50vh] overflow-auto">
      <ResponseTable v-if="canList && entry.raw" :rows="listRows()" :columns="columns" :page-size="Number.MAX_SAFE_INTEGER" :list-path="effParse.listPath" />
      <p v-else class="p-3 font-mono text-xs text-muted-foreground">{{ entry.error ?? '该响应未匹配到列表，请先在 JSON 视图里把鼠标移到某个数组上点「⇘ 设为列表」，或到「解析」页配置列表路径' }}</p>
    </div>
    </div>
  </TooltipProvider>
</template>