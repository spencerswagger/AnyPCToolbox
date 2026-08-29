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
</script>

<template>
  <div class="space-y-3">
    <!-- 顶部排序：Method + URL -->
    <div class="flex items-center gap-2">
      <select
        :value="api.method" @change="patch({ method: ($event.target as HTMLSelectElement).value as HttpMethod })"
        class="rounded-md border-border border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        class="flex-1 rounded-md border-border border bg-background px-2 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="URL 模板，支持 {{var}}"
        :value="api.urlTemplate"
        @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- 可折叠侧栏分组 -->
    <section v-for="g in ([{ k:'query', title:'Query Parameters', rows:api.query },{ k:'headers', title:'Headers', rows:api.headers }] as const)" :key="g.k" class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open[g.k] = !open[g.k]">
        <span class="text-sm font-medium">{{ g.title }}</span>
        <span class="text-muted-foreground">{{ open[g.k] ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open[g.k]" class="border-t border-border p-3">
        <KvRows :rows="g.rows" @update="patch(g.k === 'query' ? { query: $event } : { headers: $event })" />
      </div>
    </section>

    <section class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open.body = !open.body">
        <span class="text-sm font-medium">Body</span><span class="text-muted-foreground">{{ open.body ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.body" class="border-t border-border p-3">
        <div class="mb-2 flex gap-1">
          <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
            class="rounded-md px-2 py-1 text-xs" :class="api.bodyType === bt ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'">{{ bt }}</button>
        </div>
        <textarea
          class="h-40 w-full rounded-md border-border border bg-background p-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="body 内容（{{var}} 会被提取）"
          :value="api.bodyText"
          @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
        ></textarea>
      </div>
    </section>

    <!-- 解析配置 -->
    <section class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open.parse = !open.parse">
        <span class="text-sm font-medium">解析配置</span><span class="text-muted-foreground">{{ open.parse ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.parse" class="space-y-2 border-t border-border p-3 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">列表 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">总数 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" /></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">页码 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <div>
          <div class="mb-1 text-xs text-muted-foreground">字段列（name / 标题 / 类型 / 枚举映射）</div>
          <div v-for="(c, i) in parse.columns" :key="i" class="mb-1.5 flex flex-wrap items-center gap-1.5">
            <input class="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono" :value="c.field"
              @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="字段名" />
            <input class="w-24 rounded-md border border-border bg-background px-2 py-1" :value="c.title"
              @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="标题" />
            <select class="rounded-md border border-border bg-background px-1 py-1" :value="c.type"
              @change="setCol(i, { type: ($event.target as HTMLSelectElement).value as ColumnType })">
              <option v-for="t in colTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-if="c.type === 'enum'" class="w-48 rounded-md border border-border bg-background px-2 py-1 font-mono" :value="fmtEnum(c.enumMap)"
              @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
            <button class="text-muted-foreground hover:text-destructive" @click="removeCol(i)">✕</button>
          </div>
          <button class="text-sm text-primary hover:underline" @click="addCol">+ 添加列</button>
        </div>
      </div>
    </section>
  </div>
</template>