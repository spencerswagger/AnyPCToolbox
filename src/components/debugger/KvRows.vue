<script setup lang="ts">
import type { KvItem } from '@/lib/debugger/model'

const props = defineProps<{ rows: KvItem[] }>()
const emit = defineEmits<{ (e: 'update', rows: KvItem[]): void }>()

function toRows() {
  // 用 props 深拷贝避免直接改
  return JSON.parse(JSON.stringify(props.rows)) as KvItem[]
}
function set(key: string, value: string, i: number) {
  const rows = toRows()
  rows[i] = { key, value }
  emit('update', rows)
}
function remove(i: number) {
  const rows = toRows()
  rows.splice(i, 1)
  emit('update', rows)
}
function add() {
  emit('update', [...toRows(), { key: '', value: '' }])
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-1.5">
      <input
        class="w-1/2 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :value="r.key" placeholder="key" @input="set(($event.target as HTMLInputElement).value, r.value, i)"
      />
      <input
        class="flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :value="r.value" placeholder="value（可 {{var}}）" @input="set(r.key, ($event.target as HTMLInputElement).value, i)"
      />
      <button class="rounded border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" @click="remove(i)">✕</button>
    </div>
    <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" @click="add">+ add</button>
  </div>
</template>