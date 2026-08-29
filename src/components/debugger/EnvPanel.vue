<script setup lang="ts">
import type { ApiRequest } from '@/lib/debugger/model'
import { exportApi, importApi } from '@/lib/debugger/io'
import { ref, watch } from 'vue'

const literalVar = '{{var}}'
const props = defineProps<{
  globals: Record<string, string>
  api: ApiRequest
}>()
const emit = defineEmits<{
  (e: 'globals', g: Record<string, string>): void
  (e: 'import', api: ApiRequest): void
}>()

// 以行为编辑结构的本地副本，序列化时丢弃空名
const items = ref<{ name: string; value: string }[]>([])
watch(() => props.globals, (g) => {
  items.value = Object.entries(g || {}).map(([name, value]) => ({ name, value }))
}, { immediate: true })

function emitAll() {
  const obj: Record<string, string> = {}
  items.value.forEach((it) => { const n = it.name.trim(); if (n) obj[n] = it.value })
  emit('globals', obj)
}
function setRow(i: number, p: Partial<{ name: string; value: string }>) {
  items.value = items.value.map((it, idx) => (idx === i ? { ...it, ...p } : it))
  emitAll()
}
function add() {
  items.value = [...items.value, { name: '', value: '' }]
}
function remove(i: number) {
  items.value = items.value.filter((_, idx) => idx !== i)
  emitAll()
}

function doExport() {
  const blob = new Blob([exportApi(props.api)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.api.name}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  file.text().then((t) => { const api = importApi(t); if (api) emit('import', api) })
}
function doCopy() {
  try {
    navigator.clipboard?.writeText(exportApi(props.api))
  } catch {
    /* 静默 */
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="httpd-panel">
      <div class="httpd-panel-title">
        <span class="httpd-eyebrow text-muted-foreground">global variables</span>
        <span class="text-xs text-muted-foreground">（{{ literalVar }}）</span>
      </div>
      <div class="p-3">
        <div v-for="(it, i) in items" :key="i" class="mb-1.5 flex items-center gap-1.5">
          <input class="w-28 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs" :value="it.name" placeholder="name"
            @input="setRow(i, { name: ($event.target as HTMLInputElement).value })" />
          <input class="flex-1 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs" :value="it.value" placeholder="value"
            @input="setRow(i, { value: ($event.target as HTMLInputElement).value })" />
          <button class="rounded border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" @click="remove(i)">✕</button>
        </div>
        <button class="httpd-btn rounded border border-border px-2 py-0.5 text-xs text-primary hover:bg-accent" @click="add">+ add var</button>
      </div>
    </section>
    <section class="httpd-panel">
      <div class="httpd-panel-title">
        <span class="httpd-eyebrow text-muted-foreground">import / export</span>
      </div>
      <div class="flex gap-2 p-3">
        <button class="httpd-btn rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90" @click="doExport">export</button>
        <label class="httpd-btn cursor-pointer rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
          import<input type="file" accept="application/json" class="hidden" @change="onImport" />
        </label>
        <button class="httpd-btn rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent" @click="doCopy">copy json</button>
      </div>
    </section>
  </div>
</template>