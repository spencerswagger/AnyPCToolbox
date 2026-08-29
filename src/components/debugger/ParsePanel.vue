<script setup lang="ts">
import type { ApiRequest, ColumnDef, ColumnType, PagingConfig } from '@/lib/debugger/model'
import type { HistoryEntry } from '@/lib/debugger/db'
import { PAGING_PRESETS, presetToConfig, type PagingPreset } from '@/lib/debugger/paging'
import { parseResponse, inferParse, evalPath, columnsForList } from '@/lib/debugger/parse'
import FieldTip from './FieldTip.vue'
import ResponseView from './ResponseView.vue'
import { computed } from 'vue'
import { TooltipProvider } from 'radix-vue'

const props = defineProps<{ api: ApiRequest; history: HistoryEntry[]; picked: HistoryEntry | null }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
  (e: 'goRun'): void
}>()

const colTypes = ['text', 'number', 'bool', 'enum', 'image', 'datetime', 'link', 'object', 'array'] as const

function patchParse(p: Partial<ApiRequest['parse']>) {
  emit('update', { ...props.api, parse: { ...props.api.parse, ...p } })
}

// ---- 字段列编辑 ----
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

// 在预览 JSON 树 / 对象「查看」里选中新列表 → 更新 listPath 并按新列表重推字段列（递归下钻）
function onPickList(path: string) {
  if (!path) return
  const json = props.picked?.raw ? parseResponse(props.picked.raw, props.api.parse).json : null
  const arr = json !== null && json !== undefined ? evalPath(json, path) : null
  const cols = Array.isArray(arr) ? columnsForList(arr) : []
  emit('update', { ...props.api, parse: { ...props.api.parse, listPath: path, columns: cols.length ? cols : props.api.parse.columns } })
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

// ---- 分页配置 ----
const currentPreset = computed<PagingPreset | null>(() => {
  const p = props.api.paging
  if (!p) return null
  return PAGING_PRESETS.find((x) =>
    x.mode === p.mode && x.pageParam === p.pageParam && x.sizeParam === p.sizeParam && x.offsetParam === p.offsetParam
  ) ?? null
})
function patchPaging(p: Partial<PagingConfig>) {
  emit('update', { ...props.api, paging: { ...props.api.paging, ...p } })
}
function applyPreset(key: string) {
  const p = PAGING_PRESETS.find((x) => x.key === key)
  if (p) patchPaging({ ...presetToConfig(p, props.api.paging.size || 10), enabled: true })
}
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <div class="space-y-3">
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FieldTip side="right" text="使用说明">
          从左侧「历史记录」选一条响应点「✧ 自动推断」，即可自动生成列表路径与字段列；也可手动编辑下面的 JSONPath、字段列与分页参数。分页在「调试」页翻页时生效。
        </FieldTip>
      </div>

      <!-- 解析来源 -->
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
            <ResponseView v-else :raw="picked.raw" :parse="api.parse" :columns="api.parse.columns" @pick="onPickList" />
          </template>
          <div v-else-if="history.length" class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>▸ 请在左侧「历史记录」选择一条响应来解析。</span>
          </div>
          <div v-else class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>还没有历史请求。先到「调试」页发送一次请求，再回来这里解析。</span>
            <button class="httpd-btn rounded border border-border px-2 py-0.5 text-primary hover:bg-accent" @click="emit('goRun')">→ 去调试</button>
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
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
          <label class="flex flex-col gap-1">
            <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">总记录数<FieldTip>总记录数字段的 JSONPath，如 $.data.total。用于计算总页数；留空则不显示总数。</FieldTip></span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.total" /></label>
          <label class="flex flex-col gap-1">
            <span class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">当前页码<FieldTip>当前页码字段的 JSONPath，如 $.data.page。用于翻页后自动同步当前页。</FieldTip></span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" placeholder="$.data.page" /></label>
        </div>
      </div>

      <!-- 字段列 -->
      <div class="httpd-panel overflow-hidden">
        <div class="flex items-center gap-1.5 px-3 py-2">
          <span class="httpd-eyebrow text-foreground">字段列</span>
          <FieldTip>定义列表在「列表」视图中展示的列：字段名（列表对象里的 key）、列标题、以及类型（text / number / bool / enum / image / datetime / link）。可在上方「✧ 自动推断」自动生成。</FieldTip>
          <button class="ml-auto httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" @click="addCol">+ 新增</button>
        </div>
        <div class="space-y-1.5 border-t border-border p-3">
          <div v-for="(c, i) in api.parse.columns" :key="i" class="flex flex-wrap items-center gap-1.5">
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.field"
              title="源字段：列表对象中的 key" @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="字段名" />
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.title"
              title="列标题：列表表头显示的文字" @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="列标题" />
            <select class="rounded border border-border bg-background px-1 py-1 font-mono text-xs" :value="c.type" @change="setCol(i, { type: ($event.target as HTMLSelectElement).value as ColumnType })">
              <option v-for="t in colTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-if="c.type === 'enum'" class="w-auto flex-1 min-w-[10rem] rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="fmtEnum(c.enumMap)"
              title="枚举映射，格式：值:文案，多个用逗号分隔，如 1:男,2:女" @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
            <button class="text-muted-foreground hover:text-destructive" title="删除该列" @click="removeCol(i)">✕</button>
          </div>
          <p v-if="!api.parse.columns.length" class="font-mono text-xs text-muted-foreground">// 尚未定义列，可点击「+ 新增」手动添加，或点上方「✧ 自动推断」。</p>
        </div>
      </div>

      <!-- 分页配置 -->
      <div class="httpd-panel overflow-hidden">
        <div class="flex items-center gap-1.5 px-3 py-2">
          <span class="httpd-eyebrow text-foreground">分页配置</span>
          <FieldTip>开启后，「调试」页会显示上一页 / 下一页翻页器，翻页时按所选风格自动注入分页参数。支持 page/pageSize（页码式）与 limit/offset（游标式）等主流风格，也可用「✧ 自动推断」根据返回数据自动补全。</FieldTip>
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
  </TooltipProvider>
</template>