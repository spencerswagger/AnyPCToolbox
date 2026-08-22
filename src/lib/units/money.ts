// 货币：符号/代码识别对照 + 快照汇率换算（纯函数，汇率以 USD 为基准）
export interface Rates {
  base: string
  _source?: string
  _updatedAt?: string
  _fetchedAt?: number
  rates: Record<string, number>
}

export interface CurrencyInfo {
  code: string
  name: string
}

/** 结果卡片默认列出的常用币种（避免 160 行刷屏） */
export const COMMON_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: '美元' },
  { code: 'CNY', name: '人民币' },
  { code: 'EUR', name: '欧元' },
  { code: 'GBP', name: '英镑' },
  { code: 'JPY', name: '日元' },
  { code: 'HKD', name: '港币' },
  { code: 'AUD', name: '澳元' },
  { code: 'CAD', name: '加元' },
  { code: 'SGD', name: '新加坡元' },
  { code: 'CHF', name: '瑞士法郎' },
]

/** 符号 → 币种对照表（藏于顶栏帮助 tooltip） */
export const CURRENCY_SYMBOLS: Array<{ symbols: string; name: string; code: string }> = [
  { symbols: '$ / US$ / USD', name: '美元', code: 'USD' },
  { symbols: '¥ / CN¥ / CNY', name: '人民币', code: 'CNY' },
  { symbols: '€ / EUR', name: '欧元', code: 'EUR' },
  { symbols: '£ / GBP', name: '英镑', code: 'GBP' },
  { symbols: 'JP¥ / 円 / JPY', name: '日元', code: 'JPY' },
  { symbols: 'HK$ / HKD', name: '港币', code: 'HKD' },
  { symbols: 'A$ / AUD', name: '澳元', code: 'AUD' },
  { symbols: 'C$ / CAD', name: '加元', code: 'CAD' },
  { symbols: 'S$ / SGD', name: '新加坡元', code: 'SGD' },
  { symbols: 'CHF', name: '瑞士法郎', code: 'CHF' },
]

export function currencyName(code: string): string {
  return COMMON_CURRENCIES.find((c) => c.code === code)?.name ?? code
}

export function hasRate(code: string, rates?: Rates | null): boolean {
  if (!rates) return false
  const r = rates.rates[code]
  return typeof r === 'number' && r > 0
}

/** 币种数值 → USD：1 USD = rates[code] 币，故 valueUsd = value / rates[code] */
export function toUsd(value: number, code: string, rates: Rates): number | null {
  const r = rates.rates[code]
  if (typeof r !== 'number' || r <= 0) return null
  return value / r
}

/** USD → 任意币种 */
export function fromUsd(usd: number, code: string, rates: Rates): number | null {
  const r = rates.rates[code]
  if (typeof r !== 'number' || r <= 0) return null
  return usd * r
}

export interface MoneyEquivalent {
  unit: string
  name: string
  value: number
  noRate?: boolean
}

/** 列常用币种等价项；无快照或缺数据 → 全部标注 noRate（value 置 0，前端显示「无汇率数据」） */
export function equivalentCurrencies(
  value: number,
  from: string,
  rates: Rates | null,
): MoneyEquivalent[] {
  const markAllNoRate = (): MoneyEquivalent[] =>
    COMMON_CURRENCIES.map((c) => ({ unit: c.code, name: c.name, value: 0, noRate: true }))

  if (!rates) return markAllNoRate()
  const usd = toUsd(value, from, rates)
  if (usd === null) return markAllNoRate()
  return COMMON_CURRENCIES.filter((c) => c.code !== from).map((c) => {
    const v = fromUsd(usd, c.code, rates)
    return { unit: c.code, name: c.name, value: v === null ? 0 : v, noRate: v === null }
  })
}
