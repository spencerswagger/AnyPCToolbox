<script setup lang="ts">
import { reactive, computed } from 'vue'
import {
  encodeBase64, decodeBase64,
  decodeUrl, encodeUnicode, decodeUnicode,
  encodeHex, decodeHex, encodeHtml, decodeHtml, rot, type Result,
} from '@/lib/text/encoders'

const props = defineProps<{ input: string; algo: string }>()

type ConfigValue = boolean | number | string

interface ConfigDef {
  key: string
  label: string
  kind: 'bool' | 'number' | 'select'
  options?: string[]
  min?: number
  max?: number
  def: ConfigValue
}
interface SubItem {
  id: string
  label: string
  configs: ConfigDef[]
  enc: (s: string, cfg: Record<string, ConfigValue>) => Result
  dec: (s: string, cfg: Record<string, ConfigValue>) => Result
}

/** 各配置项的响应式值（按 kind 分 3 张表，保证模板 v-model 类型安全） */
const boolCfg = reactive<Record<string, Record<string, boolean>>>({})
const numCfg = reactive<Record<string, Record<string, number>>>({})
const strCfg = reactive<Record<string, Record<string, string>>>({})

function cfgOf(id: string): Record<string, ConfigValue> {
  return { ...boolCfg[id], ...numCfg[id], ...strCfg[id] }
}

// ---------- 各算法实现（带参数） ----------
function b64Encode(s: string, c: Record<string, ConfigValue>): Result {
  const r = encodeBase64(s)
  if (!r.ok) return r
  let v = r.value
  if (c.urlSafe === true) v = v.replace(/\+/g, '-').replace(/\//g, '_')
  if (c.pad === false) v = v.replace(/=+$/, '')
  if (c.upper === true) v = v.toUpperCase()
  return { ok: true, value: v }
}
function b64Decode(s: string, c: Record<string, ConfigValue>): Result {
  let v = s.replace(/[\r\n]/g, '')
  if (c.urlSafe === true) v = v.replace(/-/g, '+').replace(/_/g, '/')
  return decodeBase64(v)
}
function urlEncode(s: string, c: Record<string, ConfigValue>): Result {
  try {
    return { ok: true, value: c.preserveUri === true ? encodeURI(s) : encodeURIComponent(s) }
  } catch {
    return { ok: false, error: 'URL 编码失败' }
  }
}
function unicodeUpper(v: string): string {
  return v.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => `\\u${h.toUpperCase()}`)
}
function unicodeEncode(s: string, c: Record<string, ConfigValue>): Result {
  const r = encodeUnicode(s)
  if (!r.ok) return r
  return c.upperHex === true ? { ok: true, value: unicodeUpper(r.value) } : r
}
function hexEnc(s: string, c: Record<string, ConfigValue>): Result {
  const r = encodeHex(s)
  if (!r.ok) return r
  let v = c.upperCase === true ? r.value.toUpperCase() : r.value
  const sep = c.separator === '空格' ? ' ' : c.separator === '冒号' ? ':' : ''
  if (sep) v = v.match(/.{1,2}/g)?.join(sep) ?? v
  return { ok: true, value: v }
}
function hexDec(s: string, _c: Record<string, ConfigValue>): Result {
  return decodeHex(s.replace(/[\s:-]/g, ''))
}
function htmlEncode(s: string, c: Record<string, ConfigValue>): Result {
  if (c.named !== false) return encodeHtml(s)
  let out = ''
  for (const ch of Array.from(s)) {
    if (/[&<>"']/.test(ch)) out += `&#${ch.codePointAt(0)};`
    else out += ch
  }
  return { ok: true, value: out }
}

// ---------- 算法注册（每种算法一个 tab，面板只渲染当前兜 `algo` 的那一个） ----------
const subs: SubItem[] = [
  {
    id: 'base64',
    label: 'Base64',
    configs: [
      { key: 'urlSafe', label: 'URL 安全', kind: 'bool', def: false },
      { key: 'pad', label: '补 = 填充', kind: 'bool', def: true },
      { key: 'upper', label: '大写', kind: 'bool', def: false },
    ],
    enc: b64Encode,
    dec: b64Decode,
  },
  {
    id: 'url',
    label: 'URL',
    configs: [{ key: 'preserveUri', label: '保留 URI 字符', kind: 'bool', def: false }],
    enc: urlEncode,
    dec: (s) => decodeUrl(s),
  },
  {
    id: 'unicode',
    label: 'Unicode',
    configs: [{ key: 'upperHex', label: 'Hex 大写', kind: 'bool', def: false }],
    enc: unicodeEncode,
    dec: (s) => decodeUnicode(s),
  },
  {
    id: 'hex',
    label: 'Hex',
    configs: [
      { key: 'upperCase', label: 'Hex 大写', kind: 'bool', def: false },
      { key: 'separator', label: '分隔符', kind: 'select', options: ['无', '空格', '冒号'], def: '无' },
    ],
    enc: hexEnc,
    dec: hexDec,
  },
  {
    id: 'html',
    label: 'HTML 实体',
    configs: [{ key: 'named', label: '命名实体', kind: 'bool', def: true }],
    enc: htmlEncode,
    dec: (s) => decodeHtml(s),
  },
  {
    id: 'rot',
    label: 'ROT',
    configs: [{ key: 'shift', label: '位移量', kind: 'number', min: 1, max: 25, def: 13 }],
    enc: (s, c) => rot(s, typeof c.shift === 'number' ? c.shift : 13),
    dec: (s, c) => rot(s, typeof c.shift === 'number' ? c.shift : 13),
  },
]

// 初始化各配置默认值
for (const it of subs) {
  boolCfg[it.id] = {}
  numCfg[it.id] = {}
  strCfg[it.id] = {}
  for (const c of it.configs) {
    if (c.kind === 'bool') boolCfg[it.id][c.key] = c.def as boolean
    else if (c.kind === 'number') numCfg[it.id][c.key] = c.def as number
    else strCfg[it.id][c.key] = c.def as string
  }
}

const activeSub = computed(() => subs.find((s) => s.id === props.algo) ?? subs[0]!)

const encResult = computed(() => (props.input ? activeSub.value.enc(props.input, cfgOf(activeSub.value.id)) : null))
const decResult = computed(() => {
  if (!props.input) return null
  const r = activeSub.value.dec(props.input, cfgOf(activeSub.value.id))
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
    <!-- 算法微调配置 -->
    <div v-if="activeSub.configs.length" class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-3">
      <label v-for="c in activeSub.configs" :key="c.key" class="flex items-center gap-2 text-sm">
        <template v-if="c.kind === 'bool'">
          <input
            v-model="boolCfg[activeSub.id][c.key]"
            type="checkbox"
            class="h-4 w-4 rounded border-input outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span class="text-muted-foreground">{{ c.label }}</span>
        </template>
        <template v-else-if="c.kind === 'number'">
          <span class="text-muted-foreground">{{ c.label }}</span>
          <input
            v-model.number="numCfg[activeSub.id][c.key]"
            type="number"
            :min="c.min"
            :max="c.max"
            class="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </template>
        <template v-else>
          <span class="text-muted-foreground">{{ c.label }}</span>
          <select
            v-model="strCfg[activeSub.id][c.key]"
            class="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option v-for="o in c.options" :key="o" :value="o">{{ o }}</option>
          </select>
        </template>
      </label>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div v-for="dir in (['编码', '解码'] as const)" :key="dir" class="rounded-lg border">
        <div class="flex items-center border-b px-3 py-2">
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ activeSub.label }} · {{ dir }}</span>
          <div v-if="(dir === '编码' ? encResult : decResult)?.ok" class="ml-auto flex gap-1">
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