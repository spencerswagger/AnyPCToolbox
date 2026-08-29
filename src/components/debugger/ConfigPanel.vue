<script setup lang="ts">
import type { ApiRequest, ColumnDef, ColumnType, HttpMethod, ParseConfig, PagingConfig } from '@/lib/debugger/model'
import { PAGING_PRESETS, presetToConfig, type PagingPreset } from '@/lib/debugger/paging'
import KvRows from './KvRows.vue'
import { computed, ref } from 'vue'

const props = defineProps<{ api: ApiRequest }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
}>()
const open = ref<Record<string, boolean>>({ query: true, headers: true, body: true, parse: true, paging: true })

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
  emit('update', { ...props.api, ...p, updatedAt: Date.now() })
}
const parse = computed(() => props.api.parse)
function patchParse(p: Partial<ParseConfig>) {
  emit('update', { ...props.api, parse: { ...props.api.parse, ...p }, updatedAt: Date.now() })
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

// ---- 分页配置 ----
function patchPaging(p: Partial<PagingConfig>) {
  emit('update', { ...props.api, paging: { ...props.api.paging, ...p }, updatedAt: Date.now() })
}
function applyPreset(key: string) {
  const p = PAGING_PRESETS.find((x) => x.key === key)
  if (p) patchPaging({ ...presetToConfig(p, props.api.paging.size || 10), enabled: true })
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
  <div class="space-y-3">
    <!-- 顶部：Method + URL -->
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
        title="请求地址模板。其中的 {{变量名}} 会在发送时被「运行」面板中的变量输入框替换；也可写入分页参数占位如 {{page}}，翻页器会覆盖该值。"
        :value="api.urlTemplate"
        @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- 可折叠分组：查询参数 / 请求头 -->
    <section v-for="g in ([{ k:'query', title:'查询参数', sub:'Query', n:'01', rows:api.query },{ k:'headers', title:'请求头', sub:'Headers', n:'02', rows:api.headers }] as const)" :key="g.k" class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open[g.k] = !open[g.k]">
        <span class="text-xs text-muted-foreground">{{ g.n }}</span>
        <span class="httpd-eyebrow text-foreground">{{ g.title }}</span>
        <span class="font-mono text-[10px] text-muted-foreground/70">{{ g.sub }}</span>
        <span class="ml-auto text-muted-foreground" :title="open[g.k] ? '收起' : '展开'">{{ open[g.k] ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open[g.k]" class="border-t border-border p-3">
        <div v-if="g.k === 'query'" class="mb-1 font-mono text-[10px] text-muted-foreground">
          提示：查询参数会拼接到 URL 问号之后。若设置了分页，翻页时 key 与「分页参数名」相同的项会被自动覆盖。
        </div>
        <div v-else class="mb-1 font-mono text-[10px] text-muted-foreground">
          提示：请求头随请求一起发送，常用于认证、Content-Type 等。
        </div>
        <KvRows :rows="g.rows" @update="patch(g.k === 'query' ? { query: $event } : { headers: $event })" />
      </div>
    </section>

    <!-- 请求体 -->
    <section class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open.body = !open.body">
        <span class="text-xs text-muted-foreground">03</span>
        <span class="httpd-eyebrow text-foreground">请求体</span><span class="font-mono text-[10px] text-muted-foreground/70">Body</span><span class="ml-auto text-muted-foreground" :title="open.body ? '收起' : '展开'">{{ open.body ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.body" class="border-t border-border p-3">
        <div class="mb-1 font-mono text-[10px] text-muted-foreground">提示：选择请求体内容类型并填写内容；其中的 &#123;&#123;var}} 占位符会被提取为变量。json / form 会自动设置对应的 Content-Type。</div>
        <div class="mb-2 flex flex-wrap gap-1">
          <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
            :title="({ none:'不发送请求体', json:'以 JSON 格式发送，自动设置 application/json', form:'以表单格式发送，自动设置 x-www-form-urlencoded', text:'以纯文本发送' } as Record<string,string>)[bt]"
            class="httpd-chip" :class="api.bodyType === bt ? 'httpd-chip-bg text-foreground' : 'text-muted-foreground'">{{ bt }}</button>
        </div>
        <textarea
          class="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="请求体内容（{{var}} 会被提取）"
          title="请求体内容。支持 {{变量}} 占位符、以及 JSON / 表单 / 纯文本"
          :value="api.bodyText"
          @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
        ></textarea>
      </div>
    </section>

    <!-- 响应解析 -->
    <section class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open.parse = !open.parse">
        <span class="text-xs text-muted-foreground">04</span>
        <span class="httpd-eyebrow text-foreground">响应解析</span><span class="font-mono text-[10px] text-muted-foreground/70">Parse</span><span class="ml-auto text-muted-foreground" :title="open.parse ? '收起' : '展开'">{{ open.parse ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.parse" class="space-y-3 border-t border-border p-3">
        <p class="font-mono text-[10px] leading-relaxed text-muted-foreground">
          通过 JSONPath 从响应 JSON 中提取「列表 / 总数 / 当前页码」。常用写法：
          <code class="text-primary">$.data.list</code>（列表）、<code class="text-primary">$.data.total</code>（总数）、<code class="text-primary">$.data.page</code>（页码）。
          在页面上也可点击响应区的「✧ 自动推断」一键生成。
        </p>
        <div class="grid grid-cols-3 gap-2">
          <label class="flex flex-col gap-1" title="列表数组的 JSONPath，如 $.data.list 或 $.data.rows。表格将按该数组渲染">
            <span class="httpd-eyebrow text-muted-foreground">列表 <span class="text-muted-foreground/70">List</span></span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
          <label class="flex flex-col gap-1" :title="'总记录数字段的 JSONPath，如 $.data.total。用于计算总页数；留空则不显示总数'">
            <span class="httpd-eyebrow text-muted-foreground">总数 <span class="text-muted-foreground/70">Total</span></span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.total" /></label>
          <label class="flex flex-col gap-1" :title="'当前页码字段的 JSONPath，如 $.data.page。用于自动同步当前页'">
            <span class="httpd-eyebrow text-muted-foreground">页码 <span class="text-muted-foreground/70">Page</span></span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" placeholder="$.data.page" /></label>
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="httpd-eyebrow text-muted-foreground" title="定义列表在表格中展示的列：字段名（列表对象里的 key）、列标题、以及类型（文本/数字/布尔/枚举/图片/时间/链接）。可在响应区「✧ 自动推断」自动生成。">字段列 <span class="text-muted-foreground/70">Columns</span></span>
            <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" title="新增一列" @click="addCol">+ 新增</button>
          </div>
          <div v-for="(c, i) in parse.columns" :key="i" class="mb-1.5 flex flex-wrap items-center gap-1.5">
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.field"
              :title="'源字段：列表对象中的 key'" @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="字段名" />
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.title"
              :title="'列标题：表格表头显示的文字'" @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="列标题" />
            <select class="rounded border border-border bg-background px-1 py-1 font-mono text-xs" :value="c.type" title="该列的渲染类型"
              @change="setCol(i, { type: ($event.target as HTMLSelectElement).value as ColumnType })">
              <option v-for="t in colTypes" :key="t" :value="t"
                :title="({ text:'普通文本', number:'数字，右对齐显示', bool:'布尔值，显示为 是/否', enum:'枚举，按下面的 值:文案 映射显示', image:'图片，渲染缩略图', datetime:'日期时间，自动格式化', link:'超链接，可点击打开' } as Record<string,string>)[t]">{{ t }}</option>
            </select>
            <input v-if="c.type === 'enum'" class="w-auto flex-1 min-w-[10rem] rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="fmtEnum(c.enumMap)"
              :title="'枚举映射，格式：值:文案，多个用逗号分隔，如 1:男,2:女'" @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
            <button class="text-muted-foreground hover:text-destructive" title="删除该列" @click="removeCol(i)">✕</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 分页配置 -->
    <section class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open.paging = !open.paging">
        <span class="text-xs text-muted-foreground">05</span>
        <span class="httpd-eyebrow text-foreground">分页配置</span><span class="font-mono text-[10px] text-muted-foreground/70">Paging</span><span class="ml-auto text-muted-foreground" :title="open.paging ? '收起' : '展开'">{{ open.paging ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.paging" class="space-y-3 border-t border-border p-3">
        <p class="font-mono text-[10px] leading-relaxed text-muted-foreground">
          配置后，响应区会出现「上一页 / 下一页」翻页器，翻页时自动按所选风格向请求注入分页参数。
          主流分页风格都支持：<code class="text-primary">page/pageSize</code>（页码）、<code class="text-primary">limit/offset</code>（游标偏移）等。
          也可点击响应区的「✧ 自动推断」根据返回的数据自动补全。
        </p>
        <label class="flex items-center gap-2 text-xs" title="开启后才会显示并注入分页参数">
          <input type="checkbox" class="accent-primary" :checked="api.paging.enabled" @change="patchPaging({ enabled: ($event.target as HTMLInputElement).checked })" />
          <span class="text-foreground">启用分页</span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="httpd-eyebrow text-muted-foreground" title="选择一套主流分页参数风格，会自动填入下方参数名">分页风格预设</span>
          <select class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="currentPreset?.key ?? ''" @change="applyPreset(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>{{ currentPreset ? '（自定义参数）' : '请选择一种风格' }}</option>
            <option v-for="p in PAGING_PRESETS" :key="p.key" :value="p.key" :title="p.hint">{{ p.label }}</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1" title="分页模式：页码式发送页码+每页条数；游标式发送 limit+offset">
            <span class="httpd-eyebrow text-muted-foreground">分页模式</span>
            <select class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.mode" @change="patchPaging({ mode: ($event.target as HTMLSelectElement).value as PagingConfig['mode'] })">
              <option value="page" title="页码 + 每页条数。如 page=2&pageSize=20">页码式 (page/size)</option>
              <option value="offset" title="游标偏移。如 limit=20&offset=20，offset=(页码-1)×每页条数">游标式 (limit/offset)</option>
            </select>
          </label>
          <label class="flex flex-col gap-1" title="每次翻页请求的条数，也是游标式 offset 步长">
            <span class="httpd-eyebrow text-muted-foreground">每页条数</span>
            <input type="number" min="1" class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.size"
              @input="patchPaging({ size: Number(($event.target as HTMLInputElement).value) || 10 })" />
          </label>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <label class="flex flex-col gap-1" :title="'页码参数名。页码式：如 page；游标式不使用'">
            <span class="httpd-eyebrow text-muted-foreground">页码参数</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.pageParam"
              @input="patchPaging({ pageParam: ($event.target as HTMLInputElement).value })" placeholder="page" /></label>
          <label class="flex flex-col gap-1" :title="'每页条数参数名。页码式：如 pageSize；游标式：如 limit'">
            <span class="httpd-eyebrow text-muted-foreground">条数参数</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.sizeParam"
              @input="patchPaging({ sizeParam: ($event.target as HTMLInputElement).value })" placeholder="pageSize" /></label>
          <label class="flex flex-col gap-1" :title="'偏移参数名。游标式：如 offset / start / skip；页码式不使用'">
            <span class="httpd-eyebrow text-muted-foreground">偏移参数</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="api.paging.offsetParam"
              @input="patchPaging({ offsetParam: ($event.target as HTMLInputElement).value })" placeholder="offset" /></label>
        </div>
      </div>
    </section>
  </div>
</template>