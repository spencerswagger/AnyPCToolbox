<script setup lang="ts">
import type { ApiRequest, ColumnDef, ColumnType, HttpMethod, ParseConfig } from '@/lib/debugger/model'
import KvRows from './KvRows.vue'
import { computed, ref } from 'vue'

const props = defineProps<{ api: ApiRequest }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
}>()
const open = ref<Record<string, boolean>>({ query: true, headers: true, body: true, parse: true })

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
        :value="api.urlTemplate"
        @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- 可折叠分组：query / headers -->
    <section v-for="g in ([{ k:'query', title:'query', n:'01', rows:api.query },{ k:'headers', title:'headers', n:'02', rows:api.headers }] as const)" :key="g.k" class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open[g.k] = !open[g.k]">
        <span class="text-xs text-muted-foreground">{{ g.n }}</span>
        <span class="httpd-eyebrow text-foreground">{{ g.title }}</span>
        <span class="ml-auto text-muted-foreground">{{ open[g.k] ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open[g.k]" class="border-t border-border p-3">
        <KvRows :rows="g.rows" @update="patch(g.k === 'query' ? { query: $event } : { headers: $event })" />
      </div>
    </section>

    <!-- Body -->
    <section class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open.body = !open.body">
        <span class="text-xs text-muted-foreground">03</span>
        <span class="httpd-eyebrow text-foreground">body</span><span class="ml-auto text-muted-foreground">{{ open.body ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.body" class="border-t border-border p-3">
        <div class="mb-2 flex flex-wrap gap-1">
          <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
            class="httpd-chip" :class="api.bodyType === bt ? 'httpd-chip-bg text-foreground' : 'text-muted-foreground'">{{ bt }}</button>
        </div>
        <textarea
          class="h-40 w-full rounded border border-border bg-background p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="body 内容（{{var}} 会被提取）"
          :value="api.bodyText"
          @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
        ></textarea>
      </div>
    </section>

    <!-- 解析配置 -->
    <section class="httpd-panel overflow-hidden">
      <button class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="open.parse = !open.parse">
        <span class="text-xs text-muted-foreground">04</span>
        <span class="httpd-eyebrow text-foreground">parse</span><span class="ml-auto text-muted-foreground">{{ open.parse ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.parse" class="space-y-3 border-t border-border p-3">
        <div class="grid grid-cols-3 gap-2">
          <label class="flex flex-col gap-1"><span class="httpd-eyebrow text-muted-foreground">list</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
          <label class="flex flex-col gap-1"><span class="httpd-eyebrow text-muted-foreground">total</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" /></label>
          <label class="flex flex-col gap-1"><span class="httpd-eyebrow text-muted-foreground">page</span>
            <input class="rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="httpd-eyebrow text-muted-foreground">columns</span>
            <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" @click="addCol">+ add</button>
          </div>
          <div v-for="(c, i) in parse.columns" :key="i" class="mb-1.5 flex flex-wrap items-center gap-1.5">
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.field"
              @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="field" />
            <input class="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="c.title"
              @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="title" />
            <select class="rounded border border-border bg-background px-1 py-1 font-mono text-xs" :value="c.type"
              @change="setCol(i, { type: ($event.target as HTMLSelectElement).value as ColumnType })">
              <option v-for="t in colTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-if="c.type === 'enum'" class="w-auto flex-1 min-w-[10rem] rounded border border-border bg-background px-2 py-1 font-mono text-xs" :value="fmtEnum(c.enumMap)"
              @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
            <button class="text-muted-foreground hover:text-destructive" @click="removeCol(i)">✕</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>