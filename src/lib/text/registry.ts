// 算法注册表：大类 → 子面板组件。新增算法只需在此挂一项 + 新增一个面板组件。
import { defineAsyncComponent, type Component } from 'vue'
import StatsPanel from '@/components/text/StatsPanel.vue'
import TimestampPanel from '@/components/text/TimestampPanel.vue'
import SmartDecodePanel from '@/components/text/SmartDecodePanel.vue'

const EncodePanel = defineAsyncComponent(() => import('@/components/text/EncodePanel.vue'))
const AesPanel = defineAsyncComponent(() => import('@/components/text/AesPanel.vue'))
const HashPanel = defineAsyncComponent(() => import('@/components/text/HashPanel.vue'))

export type Category = 'smart' | 'encode-hash' | 'aes' | 'analyze'

export interface ToolItem {
  id: string
  label: string
  category: Category
  component: Component
}

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'smart', label: '智能解码' },
  { id: 'encode-hash', label: '哈希与编解码' },
  { id: 'aes', label: '加解密' },
  { id: 'analyze', label: '分析' },
]

export const TOOL_ITEMS: ToolItem[] = [
  { id: 'smart', label: '智能解码', category: 'smart', component: SmartDecodePanel },
  { id: 'encode', label: '编解码', category: 'encode-hash', component: EncodePanel },
  { id: 'hash', label: '哈希', category: 'encode-hash', component: HashPanel },
  { id: 'aes', label: 'AES', category: 'aes', component: AesPanel },
  { id: 'stats', label: '统计', category: 'analyze', component: StatsPanel },
  { id: 'timestamp', label: '时间戳', category: 'analyze', component: TimestampPanel },
]