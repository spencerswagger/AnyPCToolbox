<script setup lang="ts">
import { computed, ref } from 'vue'
import JsonTree from './JsonTree.vue'
import ResponseTable from './ResponseTable.vue'

const props = defineProps<{
  value: unknown
  title: string
  basePath: string // 根节点 value 在完整响应中的绝对路径（仅用于展示）
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

// 弹框内逐级下钻的视图栈：JSON 树 ⇄ 列表表格。所有「设为列表 / 查看」都只在弹框内生效，不影响主页面
type Level =
  | { kind: 'tree'; value: unknown; crumb: string }
  | { kind: 'list'; rows: unknown[]; crumb: string }

const stack = ref<Level[]>([{ kind: 'tree', value: props.value, crumb: props.basePath || props.title }])
const current = computed(() => stack.value[stack.value.length - 1])

// 解析 JsonTree 发出的相对路径（如 `data.list[0]`、`[0]`）并取出对应值
function getAt(v: unknown, rel: string): unknown {
  let cur = v
  const re = /\.?([^.[\]]+)|\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rel))) {
    if (m[2] !== undefined) cur = (cur as unknown[])?.[Number(m[2])] as unknown
    else cur = (cur as Record<string, unknown>)?.[m[1]]
  }
  return cur
}
// JSON 树里点「设为列表」→ 在弹框内切换为该数组的表格，可继续逐级下钻
function pickList(rel: string) {
  const arr = getAt(current.value, rel)
  if (Array.isArray(arr)) stack.value.push({ kind: 'list', rows: arr as unknown[], crumb: rel || '列表' })
}
// 列表里的「查看」列 → 在弹框内展开该值（对象/数组），再从中可继续「设为列表」
function drillCell(value: unknown, field: string) {
  stack.value.push({ kind: 'tree', value, crumb: field })
}
function back() {
  if (stack.value.length > 1) stack.value.pop()
}
const crumb = computed(() => stack.value.map((l) => l.crumb).join(' › '))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="emit('close')">
    <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
      <div class="flex items-center gap-2 border-b border-border px-3 py-2">
        <button v-if="stack.length > 1" class="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent" title="返回上一层" @click="back">‹ 返回</button>
        <span class="httpd-eyebrow text-foreground">{{ title }}</span>
        <span class="truncate font-mono text-[10px] text-muted-foreground" :title="crumb">{{ crumb }}</span>
        <button class="ml-auto text-xs text-muted-foreground hover:text-accent-foreground" title="关闭弹窗" @click="emit('close')">✕</button>
      </div>
      <div class="min-h-0 flex-1 overflow-auto">
        <JsonTree
          v-if="current.kind === 'tree'"
          :value="current.value"
          :pickable="true"
          max-height-class=""
          @pick="pickList"
        />
        <ResponseTable
          v-else
          :rows="current.rows"
          :columns="[]"
          :page-size="Number.MAX_SAFE_INTEGER"
          :drill-cell="drillCell"
        />
      </div>
      <div class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        提示：把鼠标移到某个数组上会显示「⇘ 设为列表」，点它即把表格切到该数组，可逐级向下查看嵌套列表；点「‹ 返回」逐级退回。
      </div>
    </div>
  </div>
</template>