// 汇率数据链（stale-while-revalidate）：内置快照 → indexedDB 缓存(24h) → 在线刷新
import builtinRatesJson from '@/data/rates.json'
import type { Rates } from '@/lib/units/money'
import { readCachedRates, writeCachedRates } from '@/lib/units/idb'

export type RateSource = '内置快照' | '本地缓存' | '在线更新'

export interface RateState {
  rates: Rates
  source: RateSource
}

const ONLINE_URL = 'https://open.er-api.com/v6/latest/USD'
const FETCH_TIMEOUT_MS = 8000

const builtin = builtinRatesJson as unknown as Rates

type Listener = (s: RateState) => void
const listeners: Listener[] = []

function emit(s: RateState): void {
  for (const l of listeners) l(s)
}

/** 订阅汇率更新（在线刷新成功后触发）；返回取消订阅函数 */
export function onRatesUpdate(cb: Listener): () => void {
  listeners.push(cb)
  return () => {
    const i = listeners.indexOf(cb)
    if (i >= 0) listeners.splice(i, 1)
  }
}

/** 立即返回当前最优数据：缓存优先，否则内置快照 */
export async function loadInitialRates(): Promise<RateState> {
  const cached = await readCachedRates()
  if (cached) return { rates: cached, source: '本地缓存' }
  return { rates: builtin, source: '内置快照' }
}

/** 后台在线拉取：成功后写缓存并广播；失败静默 */
export async function refreshRatesOnline(): Promise<void> {
  const fetched = await fetchOnlineRates()
  if (!fetched) return
  await writeCachedRates(fetched)
  emit({ rates: fetched, source: '在线更新' })
}

async function fetchOnlineRates(): Promise<Rates | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(ONLINE_URL, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as {
      result?: string
      time_last_update_utc?: string
      base_code?: string
      rates?: Record<string, number>
    }
    if (data.result !== 'success' || !data.rates || !data.base_code) return null
    return {
      base: data.base_code,
      _source: ONLINE_URL,
      _updatedAt: data.time_last_update_utc ?? '',
      _fetchedAt: Date.now(),
      rates: data.rates,
    }
  } catch {
    return null
  }
}
