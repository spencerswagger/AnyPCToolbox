<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { aesEncrypt, aesDecrypt, generateSecret, type AesMode } from '@/lib/text/aes'
import { rsaGenerate, rsaEncrypt, rsaDecrypt } from '@/lib/text/rsa'

const props = defineProps<{ input: string; algo: string }>()

type R = { ok: true; value: string } | { ok: false; error: string }

// ---------- AES ----------
const secret = ref('')
const aesOpts = reactive({ mode: 'GCM' as AesMode, bits: 256 as 128 | 256, ivMode: 'random' as 'random' | 'fixed', ivHex: '' })
const aesEnc = ref<R | null>(null)
const aesDec = ref<R | null>(null)

// ---------- RSA ----------
const rsaBits = ref(2048)
const publicPem = ref('')
const privatePem = ref('')
const rsaEnc = ref<R | null>(null)
const rsaDec = ref<R | null>(null)

const working = ref(false)

const aesTitle = computed(() => `AES-${aesOpts.bits} ${aesOpts.mode} · 加密`)
const rsaTitle = 'RSA-OAEP · 加密'

function genAesKey(): void {
  secret.value = generateSecret(aesOpts.bits / 8)
  aesEnc.value = null
  aesDec.value = null
}
async function genRsaKeypair(): Promise<void> {
  working.value = true
  try {
    const kp = await rsaGenerate(rsaBits.value)
    publicPem.value = kp.publicPem
    privatePem.value = kp.privatePem
    rsaEnc.value = null
    rsaDec.value = null
  } catch {
    /* RSA 生成失败由结果框提示 */
  } finally {
    working.value = false
  }
}
function clearResults(): void {
  aesEnc.value = null
  aesDec.value = null
  rsaEnc.value = null
  rsaDec.value = null
}

async function run(): Promise<void> {
  working.value = true
  clearResults()
  if (props.algo === 'aes') {
    if (props.input) aesEnc.value = await aesEncrypt(props.input, secret.value, { ...aesOpts })
    // 解密读主输入框内容（而非加密产物）
    if (props.input) aesDec.value = await aesDecrypt(props.input, secret.value, { ...aesOpts })
  } else {
    if (props.input) rsaEnc.value = await rsaEncrypt(props.input, publicPem.value)
    if (props.input) rsaDec.value = await rsaDecrypt(props.input, privatePem.value)
  }
  working.value = false
}

function enc(): R | null {
  return props.algo === 'aes' ? aesEnc.value : rsaEnc.value
}
function dec(): R | null {
  return props.algo === 'aes' ? aesDec.value : rsaDec.value
}
function val(r: R | null): string {
  return r?.ok ? r.value : ''
}
function encVal(): string {
  return val(enc())
}
function decVal(): string {
  return val(dec())
}
function encErr(): string {
  const r = enc()
  return r && !r.ok ? r.error : ''
}
function decErr(): string {
  const r = dec()
  return r && !r.ok ? r.error : ''
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
    <!-- ============ AES 参数区 ============ -->
    <div v-if="algo === 'aes'" class="space-y-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3">
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">模式</span>
          <select v-model="aesOpts.mode" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="GCM">GCM</option>
            <option value="CBC">CBC</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">密钥长度</span>
          <select v-model.number="aesOpts.bits" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option :value="128">128 bit</option>
            <option :value="256">256 bit</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">IV/Nonce</span>
          <select v-model="aesOpts.ivMode" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="random">每次随机</option>
            <option value="fixed">固定 Hex</option>
          </select>
        </label>
        <label v-if="aesOpts.ivMode === 'fixed'" class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">Hex</span>
          <input v-model="aesOpts.ivHex" placeholder="GCM:24 位 / CBC:32 位" class="h-8 w-44 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>

      <div class="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">密钥 / 口令</span>
          <input v-model="secret" type="text" placeholder="输入口令，或点「生成密钥」" class="h-8 w-64 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <button class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="genAesKey">生成密钥</button>
        <button :disabled="working || !input" class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="run">{{ working ? '计算中…' : '加解密' }}</button>
      </div>
    </div>

    <!-- ============ RSA 参数区 ============ -->
    <div v-else class="space-y-3">
      <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <label class="flex items-center gap-2 text-sm">
          <span class="text-muted-foreground">密钥长度</span>
          <select v-model.number="rsaBits" class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option :value="1024">1024 bit</option>
            <option :value="2048">2048 bit</option>
            <option :value="3072">3072 bit</option>
            <option :value="4096">4096 bit</option>
          </select>
        </label>
        <button :disabled="working" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="genRsaKeypair">生成密钥对</button>
        <button :disabled="working || !input" class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none" @click="run">{{ working ? '计算中…' : '加解密' }}</button>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">公钥（用于加密，可粘贴）</span>
          <textarea v-model="publicPem" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">私钥（用于解密，可粘贴）</span>
          <textarea v-model="privatePem" rows="4" spellcheck="false" class="w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
        </label>
      </div>
    </div>

    <!-- ============ 结果区：加密 / 解密（都读主输入框） ============ -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ algo === 'aes' ? aesTitle : rsaTitle }}</span>
          <div v-if="enc()?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(val(enc()))">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="enc()?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ encVal() }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ encErr() || '点「加解密」计算（输入框内容即待加密文本）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
      <div class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ algo === 'aes' ? '解密' : 'RSA-OAEP · 解密' }}</span>
          <div v-if="dec()?.ok" class="ml-auto flex gap-1">
            <button class="rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" @click="copy(val(dec()))">复制</button>
          </div>
        </div>
        <template v-if="input">
          <pre v-if="dec()?.ok" class="max-h-64 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">{{ decVal() }}</pre>
          <div v-else class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>⚠️</span><span>{{ decErr() || '点「加解密」计算（输入框内容即待解密密文）' }}</span>
          </div>
        </template>
        <p v-else class="p-3 text-sm text-muted-foreground">—</p>
      </div>
    </div>
  </div>
</template>