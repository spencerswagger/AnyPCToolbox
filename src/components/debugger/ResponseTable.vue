<script setup lang="ts">
import type { ColumnDef } from '@/lib/debugger/model'
import { toCellView } from '@/lib/debugger/renderers'
import { computed, ref } from 'vue'

const props = defineProps<{ rows: unknown[]; total?: number; page?: number; pageSize: number; columns: ColumnDef[]; loading?: boolean }>()
const emit = defineEmits<{ (e: 'go', page: number): void }>()
const previewUrl = ref('')

const pageCount = computed(() => props.total !== undefined ? Math.max(1, Math.ceil(props.total / props.pageSize)) : Math.max(1, Math.ceil(props.rows.length / Math.max(1, props.pageSize))))
const cols = computed(() => {
  const seen = new Set<string>()
  props.rows.forEach((r) => { if (r && typeof r === 'object') Object.keys(r as Record<string, unknown>).forEach((k) => seen.add(k)) })
  const effective = props.columns.filter((c) => c.field)
  return effective.length ? effective : [...seen].map((k) => ({ field: k, title: k, type: 'text' as const }))
})
</script>

<template>
  <div class="flex flex-col">
    <div class="overflow-auto">
      <table class="w-full text-left text-xs">
        <thead class="sticky top-0 z-10">
          <tr class="border-b border-border bg-card/95">
            <th v-for="c in cols" :key="c.field" class="httpd-eyebrow px-3 py-2 whitespace-nowrap text-muted-foreground">{{ c.title || c.field }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i" class="border-b border-border/60 hover:bg-accent/40" :class="i % 2 ? 'bg-muted/20' : ''">
            <td v-for="c in cols" :key="c.field" class="px-3 py-2 align-middle">
            <img v-if="toCellView((r as Record<string, unknown>)[c.field], c).kind === 'image'"
              :src="toCellView((r as Record<string, unknown>)[c.field], c).text" class="h-10 w-10 cursor-zoom-in rounded object-cover" @click="previewUrl = toCellView((r as Record<string, unknown>)[c.field], c).text" />
            <a v-else-if="toCellView((r as Record<string, unknown>)[c.field], c).kind === 'link'"
              :href="toCellView((r as Record<string, unknown>)[c.field], c).text" target="_blank" rel="noreferrer" class="text-primary hover:underline">{{ toCellView((r as Record<string, unknown>)[c.field], c).text }}</a>
            <span v-else>{{ toCellView((r as Record<string, unknown>)[c.field], c).text || '-' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="p-4 text-center font-mono text-xs text-muted-foreground">{{ loading ? 'loading…' : 'no data' }}</p>
    <div v-if="pageCount > 1" class="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
      <span class="font-mono text-muted-foreground">page {{ page }} / {{ pageCount }} · {{ total ?? rows.length }} rows</span>
      <div class="flex gap-1">
        <button class="httpd-btn rounded border border-border px-2.5 py-0.5 text-muted-foreground hover:bg-accent disabled:opacity-40" :disabled="loading || !page || page <= 1" @click="emit('go', (page ?? 1) - 1)">‹ prev</button>
        <button class="httpd-btn rounded border border-border px-2.5 py-0.5 text-muted-foreground hover:bg-accent disabled:opacity-40" :disabled="loading || pageCount <= (page ?? 1)" @click="emit('go', (page ?? 1) + 1)">next ›</button>
      </div>
    </div>
  </div>
  <!-- 图片预览 -->
  <div v-if="previewUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70" @click="previewUrl = ''">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[80vw] rounded border border-border shadow-2xl" />
  </div>
</div>
</template>