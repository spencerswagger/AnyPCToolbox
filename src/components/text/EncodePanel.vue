<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url,
  encodeUrl, decodeUrl, encodeUnicode, decodeUnicode,
  encodeHex, decodeHex, encodeHtml, decodeHtml, rot, type Result,
} from '@/lib/text/encoders'

const props = defineProps<{ input: string }>()

const rotShift = ref(13)
const allSubs: { id: string; label: string; enc: (s: string) => Result; dec: (s: string) => Result }[] = [
  { id: 'base64', label: 'Base64', enc: encodeBase64, dec: decodeBase64 },
  { id: 'base64url', label: 'Base64URL', enc: encodeBase64Url, dec: decodeBase64Url },
  { id: 'url', label: 'URL', enc: encodeUrl, dec: decodeUrl },
  { id: 'unicode', label: 'Unicode', enc: encodeUnicode, dec: decodeUnicode },
  { id: 'hex', label: 'Hex', enc: encodeHex, dec: decodeHex },
  { id: 'html', label: 'HTML 实体', enc: encodeHtml, dec: decodeHtml },
  { id: 'rot', label: 'ROT13', enc: (s) => rot(s, rotShift.value), dec: (s) => rot(s, rotShift.value) },
]

const active = ref('base64')
const activeSub = computed(() => allSubs.find((s) => s.id === active.value) ?? allSubs[0]!)

const encResult = computed(() => (props.input ? activeSub.value.enc(props.input) : null))
const decResult = computed(() => {
  if (!props.input) return null
  const r = activeSub.value.dec(props.input)
  return r.ok && r.value && r.value !== props.input ? r : { ok: false as const, error: '该方向不适用' }
})

function directionResult(dir: '编码' | '解码'): Result | null {
  return dir === '编码' ? encResult.value : decResult.value
}
function resultValue(r: Result | null): string {
  return r?.ok ? r.value : ''
}
function resultError(r: Result | null): string {
  return r && !r.ok ? r.error : ''
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 静默 */
  }
}
function download(text: string, name: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-1">
      <button
        v-for="s in allSubs"
        :key="s.id"
        class="rounded-md px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="active === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'"
        @click="active = s.id"
      >
        {{ s.label }}
      </button>
    </div>

    <div v-if="active === 'rot'" class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">位移量</span>
      <input
        v-model.number="rotShift"
        type="number"
        min="1"
        max="25"
        class="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div v-for="dir in (['编码', '解码'] as const)" :key="dir" class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ activeSub.label }} · {{ dir }}</span>
          <div
            v-if="(dir === '编码' ? encResult : decResult)?.ok"
            class="ml-auto flex gap-1"
          >
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(resultValue(directionResult(dir)))">复制</button>
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="download(resultValue(directionResult(dir)), activeSub.id + '_' + dir + '.txt')">下载</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="(dir === '编码' ? encResult : decResult)?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ resultValue(directionResult(dir)) }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ resultError(directionResult(dir)) }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
    </div>
  </div>
</template>