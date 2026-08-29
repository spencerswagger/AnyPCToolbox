<script setup lang="ts">
import JsonTree from './JsonTree.vue'

const props = defineProps<{
  value: unknown
  title: string
  pickable?: boolean
  basePath: string // 根节点 value 在完整响应中的绝对路径（用于把相对 pick 换算成绝对 listPath）
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', path: string): void }>()

function pickAt(rel: string) {
  const abs = rel ? `${props.basePath}.${rel}` : props.basePath
  emit('pick', abs)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="emit('close')">
    <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
      <div class="flex items-center gap-2 border-b border-border px-3 py-2">
        <span class="httpd-eyebrow text-foreground">{{ title }}</span>
        <span class="truncate font-mono text-[10px] text-muted-foreground" title="该字段在响应中的绝对 JSONPath">{{ basePath }}</span>
        <button class="ml-auto text-xs text-muted-foreground hover:text-accent-foreground" :title="'关闭弹窗'" @click="emit('close')">✕</button>
      </div>
      <JsonTree :value="value" :pickable="pickable" @pick="pickAt" />
      <div v-if="pickable" class="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        提示：把鼠标移到某个数组上会显示「⇘ 设为列表」，点它即把表格切到该数组，可逐级向下查看嵌套列表。
      </div>
    </div>
  </div>
</template>