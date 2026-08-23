<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { sm4Encrypt, sm4Decrypt, sm4GenerateKey, type Sm4Mode, type Sm4Output, type SmResult } from '@/lib/text/sm'

const props = defineProps<{ input: string }>()

const key = ref('')
const opts = reactive<{ mode: Sm4Mode; ivHex: string; output: Sm4Output }>({
  mode: 'ecb',
  ivHex: '00000000000000000000000000000000',
  output: 'hex',
})
const enc = ref<SmResult | null>(null)
const dec = ref<SmResult | null>(null)
const working = ref(false)

const title = computed(() => `SM4-${opts.mode.toUpperCase()} · 加密`)

function genKey(): void {
  key.value = sm4GenerateKey()
  enc.value = null
  dec.value = null
}
function genIv(): void {
  opts.ivHex = sm4GenerateKey()
}
function run(): void {
  if (!props.input) return
  working.value = true
  enc.value = sm4Encrypt(props.input, key.value, { ...opts })
  dec.value = sm4Decrypt(props.input, key.value, { ...opts })
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
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3">
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">模式</span>
        <select v-model="opts.mode" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="ecb">ECB</option>
          <option value="cbc">CBC</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">密文</span>
        <select v-model="opts.output" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="hex">Hex</option>
          <option value="base64">Base64</option>
        </select>
      </label>
      <label v-if="opts.mode === 'cbc'" class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">IV</span>
        <input v-model="opts.ivHex" placeholder="32 位 hex" spellcheck="false" class="h-8 w-56 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="genIv">随机</button>
      </label>
    </div>

    <div class="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">密钥（32 位 Hex 或 16 字节字符串）</span>
        <input v-model="key" type="text" placeholder="如 0123456789abcdeffedcba9876543210" spellcheck="false" class="h-8 w-80 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
      <button class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="genKey">生成密钥</button>
      <button :disabled="working || !input" class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="run">{{ working ? '计算中…' : '加解密' }}</button>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ title }}</span>
          <div v-if="enc?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(enc.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="enc?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ enc.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ enc?.error || '点「加解密」计算（输入框内容即待加密文本）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">解密</span>
          <div v-if="dec?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(dec.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="dec?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ dec.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ dec?.error || '点「加解密」计算（输入框内容即待解密密文，自动识别 hex/base64）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
    </div>
  </div>
</template>