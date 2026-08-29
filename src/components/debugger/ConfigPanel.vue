<script setup lang="ts">
import type { ApiRequest, ColumnDef, ColumnType, HttpMethod, KvItem, ParseConfig, PagingConfig } from '@/lib/debugger/model'
import type { HistoryEntry } from '@/lib/debugger/db'
import { PAGING_PRESETS, presetToConfig, type PagingPreset } from '@/lib/debugger/paging'
import { parseResponse, inferParse } from '@/lib/debugger/parse'
import FieldTip from './FieldTip.vue'
import KvRows from './KvRows.vue'
import ResponseView from './ResponseView.vue'
import { computed, ref } from 'vue'
import { TooltipProvider } from 'radix-vue'

const props = defineProps<{ api: ApiRequest; history: HistoryEntry[]; picked: HistoryEntry | null }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
  (e: 'goRun'): void
}>()

const tabs = [
  { k: 'request', label: '请求' },
  { k: 'parse', label: '解析' },
] as const
const activeTab = ref<'request' | 'parse'>('request')

// 当前预设匹配：若与被选中预设一致则在下拉中高亮
const currentPreset = computed<PagingPreset | null>(() => {
  const p = props.api.paging
  if (!p) return null
  return PAGING_PRESETS.find((x) =>
    x.mode === p.mode && x.pageParam === p.pageParam && x.sizeParam === p.sizeParam && x.offsetParam === p.offsetParam
  ) ?? null
})

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const bodyTypes = ['none', 'json', 'form', 'text'] as const
const colTypes = ['text', 'number', 'bool', 'enum', 'image', 'datetime', 'link'] as const

function patch(p: Partial<ApiRequest>) {
  emit('update', { ...props.api, ...p })
}
const parse = computed(() => props.api.parse)
function patchParse(p: Partial<ParseConfig>) {
  emit('update', { ...props.api, parse: { ...props.api.parse, ...p } })
}

// ---- 解析配置：字段列编辑 ----
function fmtEnum(map: Record<string, string> | undefined): string {
  return map ? Object.entries(map).map(([k, v]) => `${k}:${v}`).join(',') : ''
}
function setCols(cols: ColumnDef[]) {
  patchParse({ columns: cols })
}
function setCol(i: number, p: Partial<ColumnDef>) {
  setCols(props.api.parse.columns.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
}
function setColEnum(i: number, text: string) {
  const map: Record<string, string> = {}
  text.split(',').forEach((seg) => { const m = seg.trim().split(/[:=]/); if (m[0]) map[m[0].trim()] = (m[1] ?? '').trim() })
  setCol(i, { enumMap: map })
}
function removeCol(i: number) {
  setCols(props.api.parse.columns.filter((_, idx) => idx !== i))
}
function addCol() {
  setCols([...props.api.parse.columns, { field: '', title: '', type: 'text' }])
}

// ---- 从 URL 导入查询参数：拆出 ? 之后的部分加入 query，并从 URL 移除 ----
function importFromUrl() {
  const raw = props.api.urlTemplate
  const qi = raw.indexOf('?')
  if (qi < 0) return
  const path = raw.slice(0, qi)
  const qs = raw.slice(qi + 1)
  const kv: KvItem[] = []
  new URLSearchParams(qs).forEach((v, k) => kv.push({ key: k, value: v, enabled: true }))
  if (!kv.length) return
  patch({ urlTemplate: path || '', query: [...props.api.query, ...kv] })
}

// ---- 分页配置 ----
function patchPaging(p: Partial<PagingConfig>) {
  emit('update', { ...props.api, paging: { ...props.api.paging, ...p } })
}
function applyPreset(key: string) {
  const p = PAGING_PRESETS.find((x) => x.key === key)
  if (p) patchPaging({ ...presetToConfig(p, props.api.paging.size || 10), enabled: true })
}

// ---- 对「所选历史响应」自动推断解析与分页 ----
function inferFromPicked() {
  const src = props.picked
  if (!src?.raw) return
  const json = parseResponse(src.raw, props.api.parse).json
  if (!json) { window.alert('当前历史响应不是可推断的 JSON，无法自动推断'); return }
  const inf = inferParse(json)
  if (!inf) { window.alert('未在响应中找到列表数组，请手动填写 JSONPath'); return }
  emit('update', {
    ...props.api,
    parse: { ...props.api.parse, listPath: inf.parse.listPath!, totalPath: inf.parse.totalPath, pagePath: inf.parse.pagePath, columns: inf.parse.columns },
    paging: { ...props.api.paging, ...inf.paging, enabled: true },
  })
}

// 方法 -> 工业配色类
function mCls(m: HttpMethod): string {
  const map: Record<string, string> = {
    GET: 'httpd-m-get', POST: 'httpd-m-post', PUT: 'httpd-m-put',
    PATCH: 'httpd-m-patch', DELETE: 'httpd-m-delete',
    HEAD: 'httpd-m-head', OPTIONS: 'httpd-m-options',
  }
  return map[m] ?? 'httpd-m-options'
}
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <div class="space-y-3">
      <!-- Tab 切换 -->
      <div class="flex items-center gap-1 border-b border-border">
        <button
          v-for="t in tabs" :key="t.k"
          class="px-3 py-2 text-xs font-medium tracking-wide"
          :class="activeTab === t.k ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-accent-foreground'"
          @click="activeTab = t.k"
        >{{ t.label }}</button>
        <span class="ml-auto flex items-center gap-1 pr-1 text-xs text-muted-foreground">
          <FieldTip side="left" text="使用说明">
            <b>请求</b>：地址 / 查询参数 / 请求头 / 请求体；<b>解析</b>：从历史响应自动推断并提取列表 / 字段列，并在下方配置分页翻页风格。悬停 ? 可查看字段说明。
          </FieldTip>
        </span>
      </div>

      <!-- ===== 请求 ===== -->
      <div v-if="activeTab === 'request'" class="space-y-3">
        <div class="flex items-center gap-2">
          <select
            :value="api.method" @change="patch({ method: ($event.target as HTMLSelectElement).value as HttpMethod })"
            class="h-8 rounded border border-border bg-background px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="mCls(api.method)"
          >
            <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
          </select>
          <input
            class="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="URL 模板，支持 {{var}}"
            :title="'请求地址模板。其中的 {{变量名}} 会在发送时被「运行」页的变量输入框替换；也可写入分页参数占位如 {{page}}，翻页时会覆盖该值。'"
            :value="api.urlTemplate"
            @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
          />
        </div>

        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">查询参数</span>
            <FieldTip>请求问号之后拼接的参数。若开启分页，翻页时 key 与「分页参数名」相同的项会被自动覆盖。</FieldTip>
            <button class="ml-auto httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" title="把 URL 中问号之后的参数拆出来，添加到下方查询列表，并自动从 URL 中移除" @click="importFromUrl">从 URL 导入</button>
          </div>
          <div class="border-t border-border p-3">
            <KvRows :rows="api.query" @update="patch({ query: $event })" />
          </div>
        </div>

        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">请求头</span>
            <FieldTip>随请求一起发送的 HTTP 请求头，常用于认证（Authorization）、Content-Type 等。</FieldTip>
          </div>
          <div class="border-t border-border p-3">
            <KvRows :rows="api.headers" @update="patch({ headers: $event })" />
          </div>
        </div>

        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">请求体</span>
            <FieldTip>选择内容类型：json（多行文本，自动带 Content-Type: application/json）／form（条目化 key=value，自动拼装为表单并带 x-www-form-urlencoded）／text（多行纯文本）。其中的 &#123;&#123;var}} 占位符会被提取为变量。</FieldTip>
          </div>
          <div class="space-y-2 border-t border-border p-3">
            <div class="flex flex-wrap gap-1">
              <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
                class="httpd-chip" :class="api.bodyType === bt ? 'httpd-chip-bg text-foreground' : 'text-muted-foreground'">{{ bt }}</button>
            </div>
            <!-- form 类型：条目化 key=value 配置 -->
            <div v-if="api.bodyType === 'form'">
              <KvRows :rows="api.form" @update="patch({ form: $event })" />
            </div>
            <!-- json / text：多行文本 -->
            <textarea
              v-else
              class="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="请求体内容（{{var}} 会被提取）"
              :value="api.bodyText"
              @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- ===== 解析 ===== -->
      <div v-else class="space-y-3">
        <!-- 从历史响应解析 -->
        <div class="httpd-panel overflow-hidden">
          <div class="flex flex-wrap items-center gap-2 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">解析来源</span>
            <FieldTip>勾选左侧「历史记录」中的某次响应，作为本次解析与自动推断的依据；下面的预览会即时反映当前解析规则的效果。</FieldTip>
            <button v-if="picked" class="ml-auto httpd-btn rounded border border-border px-2.5 py-0.5 text-xs text-primary hover:bg-accent" :title="'根据所选历史响应自动推断 列表 / 总数 / 页码 / 字段列，并补齐分页参数'" @click="inferFromPicked">✧ 自动推断</button>
          </div>
          <div class="border-t border-border p-3">
            <template v-if="picked">
              <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span class="httpd-pill" :class="picked.status ? 'httpd-s' + Math.floor(picked.status / 100) : 'httpd-ser'">{{ picked.status ?? 'ERR' }}</span>
                <span class="font-mono">{{ new Date(picked.ts).toLocaleString() }}</span>
                <span class="ml-auto font-mono">{{ picked.ms }}ms{{ picked.size !== undefined ? ' · ' + picked.size + ' B' : '' }}</span>
              </div>
              <p v-if="!picked.raw" class="font-mono text-xs text-destructive">{{ picked.error ?? '该历史记录无响应体' }}</p>
              <ResponseView v-else :raw="picked.raw" :parse="api.parse" :columns="api.parse.columns" />
            </template>
            <div v-else-if="history.length" class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>▸ 请在左侧「历史记录」选择一条响应来解析。</span>
            </div>
            <div v-else class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span>还没有历史请求。先到「运行」页发送一次请求，再回来这里解析。</span>
              <button class="httpd-btn rounded border border-border px-2 py-0.5 text-primary hover:bg-accent" @click="emit('goRun')">→ 去运行</button>
            </div>
          </div>
        </div>

        <!-- 位置提取 -->
        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">位置提取</span>
            <FieldTip>通过 JSONPath 从所选历史响应（或运行时的返回）中取出「列表数组 / 总记录数 / 当前页码」。常用写法：$.data.list、$.data.total、$.data.page。也可点上方「✧ 自动推断」一键生成。</FieldTip>
          </div>
          <div class="grid grid-cols-3 gap-2 border-t border-border p-3">
            <label class="flex flex-col gap-1">
              <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">列表数组<FieldTip>列表数组的 JSONPath，如 $.data.list 或 $.data.rows。表格视图将按该数组渲染。</FieldTip></span>
              <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
            <label class="flex flex-col gap-1">
              <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">总记录数<FieldTip>总记录数字段的 JSONPath，如 $.data.total。用于计算总页数；留空则不显示总数。</FieldTip></span>
              <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.total" /></label>
            <label class="flex flex-col gap-1">
              <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">当前页码<FieldTip>当前页码字段的 JSONPath，如 $.data.page。用于翻页后自动同步当前页。</FieldTip></span>
              <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" placeholder="$.data.page" /></label>
          </div>
        </div>

        <!-- 字段列 -->
        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">字段列</span>
            <FieldTip>定义列表在「表格」视图中展示的列：字段名（列表对象里的 key）、列标题、以及类型（text / number / bool / enum / image / datetime / link）。可在上方「✧ 自动推断」自动生成。</FieldTip>
            <button class="ml-auto httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" @click="addCol">+ 新增</button>
          </div>
          <div class="space-y-1.5 border-t border-border p-3">
            <div v-for="(c, i) in parse.columns" :key="i" class="flex flex-wrap items-center gap-1.5">
              <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.field"
                title="源字段：列表对象中的 key" @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="字段名" />
              <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.title"
                title="列标题：表格表头显示的文字" @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="列标题" />
              <select class="rounded border border-border bg-background px-1 py-1 font-mono text-xs" :value="c.type" @change="setCol(i, { type: ($event.target as HTMLSelectElement).value as ColumnType })">
                <option v-for="t in colTypes" :key="t" :value="t">{{ t }}</option>
              </select>
              <input v-if="c.type === 'enum'" class="w-auto flex-1 min-w-[10rem] rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="fmtEnum(c.enumMap)"
                title="枚举映射，格式：值:文案，多个用逗号分隔，如 1:男,2:女" @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
              <button class="text-muted-foreground hover:text-destructive" title="删除该列" @click="removeCol(i)">✕</button>
            </div>
            <p v-if="!parse.columns.length" class="font-mono text-xs text-muted-foreground">// 尚未定义列，可点击「+ 新增」手动添加，或点上方「✧ 自动推断」。</p>
          </div>
        </div>

        <!-- 分页配置（并入解析页，位于解析下方） -->
        <div class="httpd-panel overflow-hidden">
          <div class="flex items-center gap-1.5 px-3 py-2">
            <span class="httpd-eyebrow text-foreground">分页配置</span>
            <FieldTip>开启后，「运行」页会显示上一页 / 下一页翻页器，翻页时按所选风格自动注入分页参数。支持 page/pageSize（页码式）与 limit/offset（游标式）等主流风格，也可用「✧ 自动推断」根据返回数据自动补全。</FieldTip>
          </div>
          <div class="space-y-3 border-t border-border p-3">
            <label class="flex items-center gap-2 text-xs">
              <input type="checkbox" class="accent-primary" :checked="api.paging.enabled" @change="patchPaging({ enabled: ($event.target as HTMLInputElement).checked })" />
              <span class="flex items-center gap-1 text-foreground">启用分页</span>
            </label>

            <label class="flex flex-col gap-1">
              <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">分页风格预设<FieldTip>选择一套主流分页参数风格，会自动填入下方参数名。与预设一致时下拉会高亮该项；手动修改参数名后显示「自定义参数」。</FieldTip></span>
              <select class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="currentPreset?.key ?? ''" @change="applyPreset(($event.target as HTMLSelectElement).value)">
                <option value="" disabled>{{ currentPreset ? '（自定义参数）' : '请选择一种风格' }}</option>
                <option v-for="p in PAGING_PRESETS" :key="p.key" :value="p.key" :title="p.hint">{{ p.label }}</option>
              </select>
            </label>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1">
                <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">分页模式</span>
                <select class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.mode" @change="patchPaging({ mode: ($event.target as HTMLSelectElement).value as PagingConfig['mode'] })">
                  <option value="page">页码式 page/size</option>
                  <option value="offset">游标式 limit/offset</option>
                </select>
              </label>
              <label class="flex flex-col gap-1">
                <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">每页条数<FieldTip>每次翻页请求的条数，也是游标式 offset 的步长。</FieldTip></span>
                <input type="number" min="1" class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.size"
                  @input="patchPaging({ size: Number(($event.target as HTMLInputElement).value) || 10 })" />
              </label>
            </div>

            <div>
              <p class="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">参数名</p>
              <div class="grid grid-cols-3 gap-2">
                <label class="flex flex-col gap-1">
                  <span class="flex items-center gap-1 text-xs text-muted-foreground">页码参数<FieldTip>页码式：如 page；游标式不使用。</FieldTip></span>
                  <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.pageParam" @input="patchPaging({ pageParam: ($event.target as HTMLInputElement).value })" placeholder="page" /></label>
                <label class="flex flex-col gap-1">
                  <span class="flex items-center gap-1 text-xs text-muted-foreground">条数参数<FieldTip>页码式：如 pageSize；游标式：如 limit。</FieldTip></span>
                  <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.sizeParam" @input="patchPaging({ sizeParam: ($event.target as HTMLInputElement).value })" placeholder="pageSize" /></label>
                <label class="flex flex-col gap-1">
                  <span class="flex items-center gap-1 text-xs text-muted-foreground">偏移参数<FieldTip>游标式：如 offset / start / skip；页码式不使用。</FieldTip></span>
                  <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.offsetParam" @input="patchPaging({ offsetParam: ($event.target as HTMLInputElement).value })" placeholder="offset" /></label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>