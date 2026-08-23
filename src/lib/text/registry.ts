// 算法注册表：大类 → 子面板组件。新增算法只需在此挂一项 + 新增一个面板组件。
import { defineAsyncComponent, type Component } from 'vue'
import StatsPanel from '@/components/text/StatsPanel.vue'
import TimestampPanel from '@/components/text/TimestampPanel.vue'
import SmartDecodePanel from '@/components/text/SmartDecodePanel.vue'

const EncodePanel = defineAsyncComponent(() => import('@/components/text/EncodePanel.vue'))
const AesPanel = defineAsyncComponent(() => import('@/components/text/AesPanel.vue'))
const HashPanel = defineAsyncComponent(() => import('@/components/text/HashPanel.vue'))
const Sm2EncPanel = defineAsyncComponent(() => import('@/components/text/Sm2EncPanel.vue'))
const Sm2SignPanel = defineAsyncComponent(() => import('@/components/text/Sm2SignPanel.vue'))
const Sm3Panel = defineAsyncComponent(() => import('@/components/text/Sm3Panel.vue'))
const Sm4Panel = defineAsyncComponent(() => import('@/components/text/Sm4Panel.vue'))

export type Category = 'smart' | 'encode' | 'hash' | 'aes' | 'sm' | 'analyze'

export interface ToolItem {
  id: string
  label: string
  category: Category
  component: Component
  /** 传给面板的额外 props（如具体算法 id），让「每种算法一个 tab」复用同一面板组件 */
  props?: Record<string, unknown>
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'encode', label: '编解码' },
  { id: 'hash', label: '哈希摘要' },
  { id: 'aes', label: '加解密' },
  { id: 'sm', label: '国密' },
  { id: 'analyze', label: '分析' },
]

// 编解码：自动(智能解码)放第一个，其余每种算法一个 tab
const ENCODE_LABELS: Record<string, string> = {
  base64: 'Base64',
  url: 'URL',
  unicode: 'Unicode',
  hex: 'Hex',
  html: 'HTML 实体',
  rot: 'ROT',
}
const encodeTools: ToolItem[] = [
  { id: 'auto', label: '自动', category: 'encode', component: SmartDecodePanel },
  ...Object.keys(ENCODE_LABELS).map((algo) => ({
    id: algo,
    label: ENCODE_LABELS[algo],
    category: 'encode' as const,
    component: EncodePanel,
    props: { algo },
  })),
]

// 加解密：AES / RSA 两种算法（AES 的模式等作为其内部参数）
const CRYPTO_LABELS: Record<string, string> = {
  aes: 'AES',
  rsa: 'RSA',
}
const cryptoTools: ToolItem[] = Object.keys(CRYPTO_LABELS).map((algo) => ({
  id: algo,
  label: CRYPTO_LABELS[algo],
  category: 'aes',
  component: AesPanel,
  props: { algo },
}))

// 哈希：MD5 + SHA 系列 + SM3 合并到第一个「常用」tab；CRC32 单独一个 tab
const hashTools: ToolItem[] = [
  { id: 'common', label: '常用', category: 'hash', component: HashPanel, props: { algo: 'common' } },
  { id: 'crc32', label: 'CRC32', category: 'hash', component: HashPanel, props: { algo: 'crc32' } },
]

// 国密：SM2 加密/签名、SM3 哈希、SM4 加解密（SM2 两面板共享密钥对 store）
const smTools: ToolItem[] = [
  { id: 'sm2-enc', label: 'SM2 加密', category: 'sm', component: Sm2EncPanel },
  { id: 'sm2-sign', label: 'SM2 签名', category: 'sm', component: Sm2SignPanel },
  { id: 'sm3', label: 'SM3', category: 'sm', component: Sm3Panel },
  { id: 'sm4', label: 'SM4', category: 'sm', component: Sm4Panel },
]

export const TOOL_ITEMS: ToolItem[] = [
  ...encodeTools,
  ...hashTools,
  ...cryptoTools,
  ...smTools,
  { id: 'stats', label: '统计', category: 'analyze', component: StatsPanel },
  { id: 'timestamp', label: '时间戳', category: 'analyze', component: TimestampPanel },
]