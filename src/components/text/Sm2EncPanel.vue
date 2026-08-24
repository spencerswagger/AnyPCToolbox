<script setup lang="ts">
import { ref, computed } from 'vue'
import { sm2Keypair, sm2GenerateKeyPair, sm2Encrypt, sm2Decrypt, type SmResult, type Sm2CipherMode } from '@/lib/text/sm'

const props = defineProps<{ input: string }>()

const publicKey = computed({
  get: () => sm2Keypair.publicKey,
  set: (v: string) => {
    sm2Keypair.publicKey = v
  },
})
const privateKey = computed({
  get: () => sm2Keypair.privateKey,
  set: (v: string) => {
    sm2Keypair.privateKey = v
  },
})

const enc = ref<SmResult | null>(null)
const dec = ref<SmResult | null>(null)
const working = ref(false)
const cipherMode = ref<Sm2CipherMode>(1)

function gen(): void {
  sm2GenerateKeyPair()
  enc.value = null
  dec.value = null
}
function run(): void {
  if (!props.input) return
  working.value = true
  enc.value = sm2Encrypt(props.input, publicKey.value, cipherMode.value)
  dec.value = sm2Decrypt(props.input, privateKey.value, cipherMode.value)
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
    <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <label class="flex items-center gap-1.5 text-sm">
        <span class="text-muted-foreground">密文格式</span>
        <select v-model="cipherMode" class="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option :value="1">C1C3C2（GM 标准）</option>
          <option :value="0">C1C2C3</option>
        </select>
      </label>
      <button :disabled="working" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="gen">生成密钥对</button>
      <button :disabled="working || !input" class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="run">{{ working ? '计算中…' : '加解密' }}</button>
    </div>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">公钥（用于加密，可粘贴）</span>
        <textarea v-model="publicKey" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">私钥（用于解密，可粘贴）</span>
        <textarea v-model="privateKey" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
      </label>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">SM2 · 加密</span>
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
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">SM2 · 解密</span>
          <div v-if="dec?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(dec.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="dec?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ dec.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ dec?.error || '点「加解密」计算（输入框内容即待解密 SM2 密文）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
    </div>
  </div>
</template>