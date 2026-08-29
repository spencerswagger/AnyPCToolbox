<script setup lang="ts">
import type { KvItem } from '@/lib/debugger/model'
import { computed } from 'vue'

const props = defineProps<{ rows: KvItem[] }>()
const emit = defineEmits<{ (e: 'update', rows: KvItem[]): void }>()

function toRows() {
  // 深拷贝避免直接改 props
  return JSON.parse(JSON.stringify(props.rows)) as KvItem[]
}
function set(key: string, value: string, i: number) {
  const rows = toRows()
  rows[i] = { ...rows[i], key, value }
  emit('update', rows)
}
function toggle(i: number) {
  const rows = toRows()
  rows[i] = { ...rows[i], enabled: !(rows[i].enabled ?? true) }
  emit('update', rows)
}
function remove(i: number) {
  const rows = toRows()
  rows.splice(i, 1)
  emit('update', rows)
}
function add() {
  emit('update', [...toRows(), { key: '', value: '', enabled: true }])
}

// 是否存在已勾选的条目；用于「全选 / 全不选」状态判断
const hasAny = computed(() => props.rows.some((r) => (r.enabled ?? true)))
function setAll(on: boolean) {
  emit('update', toRows().map((r) => ({ ...r, enabled: on })))
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="rows.length" class="flex items-center gap-2 text-xs text-muted-foreground">
      <span>勾选开关：</span>
      <button class="rounded border border-border px-2 py-0.5 hover:bg-accent" :title="'取消所有勾选，全部参数都不发送'" @click="setAll(false)">全不选</button>
      <button class="rounded border border-border px-2 py-0.5 hover:bg-accent" :title="'全部勾选'" @click="setAll(true)">全选</button>
      <span class="ml-2 font-mono opacity-70">{{ hasAny ? '已勾选' + rows.filter((r) => r.enabled ?? true).length + '/' + rows.length : '（全部未勾选）' }}</span>
    </div>
    <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-1.5">
      <input
        type="checkbox"
        :checked="r.enabled ?? true"
        :title="(r.enabled ?? true) ? '已勾选：该参数会随请求发送' : '未勾选：该参数不会发送'"
        class="accent-primary"
        @change="toggle(i)"
      />
      <input
        :class="[ 'w-1/2 rounded border bg-background px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', (r.enabled ?? true) ? 'border-border' : 'border-border/50 text-muted-foreground/60 line-through' ]"
        :value="r.key" title="参数名 / 请求头名称" placeholder="参数名" @input="set(($event.target as HTMLInputElement).value, r.value, i)"
      />
      <input
        :class="[ 'flex-1 rounded border bg-background px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', (r.enabled ?? true) ? 'border-border' : 'border-border/50 text-muted-foreground/60 line-through' ]"
        :value="r.value" title="参数值，支持 {{var}} 占位符" placeholder="值（可 {{var}}）"
        @input="set(r.key, ($event.target as HTMLInputElement).value, i)"
      />
      <button class="rounded border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" title="删除这一行" @click="remove(i)">✕</button>
    </div>
    <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" title="新增加一行（默认勾选）" @click="add">+ 添加</button>
  </div>
</template>