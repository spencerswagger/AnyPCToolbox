<script setup lang="ts">
import { ref, computed } from 'vue'
import { sm2Keypair, sm2GenerateKeyPair, sm2Sign, sm2Verify, type SmResult } from '@/lib/text/sm'

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

const sig = ref<SmResult | null>(null)
const verify = ref<SmResult | null>(null)
/** 待验签的签名，手动粘贴；不随签名自动填充 */
const sigInput = ref('')
const working = ref(false)

// SM2 签名参数
const hashOn = ref(true) // 做 SM3 杂凑
const der = ref(false) // ASN.1 DER 编码
const userId = ref('1234567812345678') // 杂凑所用 UserID

function gen(): void {
  sm2GenerateKeyPair()
  sig.value = null
  verify.value = null
}
function sign(): void {
  if (!props.input) return
  working.value = true
  sig.value = sm2Sign(props.input, privateKey.value, {
    hash: hashOn.value,
    der: der.value,
    userId: userId.value,
  })
  working.value = false
}
function runVerify(): void {
  if (!props.input) return
  working.value = true
  verify.value = sm2Verify(props.input, sigInput.value, publicKey.value, {
    hash: hashOn.value,
    der: der.value,
    userId: userId.value,
  })
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
      <button :disabled="working" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="gen">生成密钥对</button>
      <button :disabled="working || !input" class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="sign">{{ working ? '计算中…' : '签名' }}</button>
      <label class="flex items-center gap-1.5 text-sm">
        <input v-model="hashOn" type="checkbox" class="h-4 w-4 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring" />
        <span class="text-muted-foreground">SM3 杂凑</span>
      </label>
      <label class="flex items-center gap-1.5 text-sm">
        <input v-model="der" type="checkbox" class="h-4 w-4 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring" />
        <span class="text-muted-foreground">DER 编码</span>
      </label>
      <label class="flex items-center gap-1.5 text-sm">
        <span class="text-muted-foreground">UserID</span>
        <input v-model="userId" spellcheck="false" class="h-7 w-40 rounded-md border border-input bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">公钥（用于验签，可粘贴）</span>
        <textarea v-model="publicKey" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">私钥（用于签名，可粘贴）</span>
        <textarea v-model="privateKey" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
      </label>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">SM2 · 签名</span>
          <div v-if="sig?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(sig.value)">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="sig?.ok" class="max-h-48 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ sig.value }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ sig?.error || '在顶部点「签名」计算（输入框内容即待签消息）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>

      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">SM2 · 验签</span>
          <button class="ml-auto inline-flex items-center justify-center rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" :disabled="!input" @click="runVerify">验签</button>
        </div>
        <div class="space-y-1.5 p-3">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">签名</span>
            <textarea v-model="sigInput" rows="3" placeholder="粘贴待验签的签名" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
          </label>
          <template v-if="input">
            <pre v-if="verify?.ok" class="whitespace-pre-wrap break-all rounded-md border p-3 font-mono text-xs" :class="verify.value === '验签通过' ? 'border-green-600/40 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'">{{ verify.value }}</pre>
            <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <span>⚠️</span><span>{{ verify?.error || '填入签名后点「验签」' }}</span>
            </div>
          </template>
          <p v-else class="text-sm text-muted-foreground">—</p>
        </div>
      </div>
    </div>
  </div>
</template>