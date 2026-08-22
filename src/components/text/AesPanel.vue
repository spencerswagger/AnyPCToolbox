<script setup lang="ts">
import { ref } from 'vue'
import { aesEncrypt, aesDecrypt, type AesResult } from '@/lib/text/aes'

const props = defineProps<{ input: string }>()

const key = ref('')
const enc = ref<AesResult | null>(null)
const dec = ref<AesResult | null>(null)
const working = ref(false)

async function run(): Promise<void> {
  working.value = true
  if (props.input) enc.value = await aesEncrypt(props.input, key.value)
  if (enc.value?.ok) dec.value = await aesDecrypt(enc.value.value, key.value)
  else dec.value = null
  working.value = false
}
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 静默 */
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">密钥</span>
        <input v-model="key" type="text" placeholder="输入口令" class="h-8 w-48 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <button
        :disabled="working"
        class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
        @click="run"
      >
        {{ working ? '计算中…' : '加解密' }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">AES-GCM · 加密</span>
          <div v-if="enc?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(enc.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="enc?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ enc.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ enc?.error ?? '点「加解密」计算' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">AES-GCM · 解密</span>
          <div v-if="dec?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(dec.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="dec?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ dec.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ dec?.error ?? '先加密生成密文' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
    </div>
  </div>
</template>