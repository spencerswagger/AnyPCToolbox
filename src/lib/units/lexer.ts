// 词法引擎：单一 token 管道，统一建模前置符号 / 后置单位 / 复合符号
// token = [符号?] 数值 [单位?]；数值支持 整数/小数/千分位/科学计数/分数/英尺-英寸复合
import { ALIASES, MAX_ALIAS_LEN, type AliasDef, type Dim } from './registry.ts'

export interface Token {
  /** 原始片段（含符号与数值；不含后置单位） */
  raw: string
  value?: number
  /** 规范单位（km、斤、USD…）；无单位时为空 */
  unit?: string
  /** 前置货币符号（$、¥、JP¥…） */
  symbol?: string
  dim?: Dim
  /** 无法识别原因（无法识别单位 / 数字格式异常） */
  error?: string
}

// 前置货币符号（多字符优先），最长匹配
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  HK$: 'HKD', US$: 'USD', 'CN¥': 'CNY', 'JP¥': 'JPY',
  A$: 'AUD', C$: 'CAD', S$: 'SGD',
  $: 'USD', '¥': 'CNY', '€': 'EUR', '£': 'GBP', 円: 'JPY',
}

const SYM_PATTERN = String.raw`HK\$|US\$|CN¥|JP¥|A\$|C\$|S\$|\$|¥|€|£|円`
const COMPOSITE = String.raw`(\d+)[']\s*(\d+)["]?`
const FRACTION = String.raw`(\d+\s*\/\s*\d+)`
const SCI = String.raw`(\d+(?:\.\d+)?[eE][+-]?\d+)`
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?|\.\d+)`
const TOKEN_RE = new RegExp(`(${SYM_PATTERN})?(-?)(?:${COMPOSITE}|${FRACTION}|${SCI}|${NUM})`, 'g')

/** 在 pos 处对注册表别名做最长匹配（允许数字与单位间有空白）；无命中返回 null */
function matchUnitAt(text: string, pos: number): AliasDef | null {
  let p = pos
  while (p < text.length && /\s/.test(text[p])) p++
  const rest = text.slice(p)
  const maxLen = Math.min(MAX_ALIAS_LEN, rest.length)
  for (let len = maxLen; len >= 1; len--) {
    const hit = ALIASES[rest.slice(0, len)]
    if (hit) return hit
  }
  return null
}

/** 切分输入文本为数值片段数组；纯文本（连接词等）被忽略 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const re = new RegExp(TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    const symbol = m[1] ?? undefined
    const sign = m[2] === '-' ? -1 : 1

    let value: number
    let isComposite = false
    if (m[3] !== undefined && m[4] !== undefined) {
      // 复合：5'9" → 5 英尺 9 英寸 = 69 英寸
      value = sign * (Number(m[3]) * 12 + Number(m[4]))
      isComposite = true
    } else if (m[5] !== undefined) {
      const [a, b] = m[5].split('/').map((s) => Number(s.trim()))
      value = b === 0 ? NaN : sign * (a / b)
    } else if (m[6] !== undefined) {
      value = sign * Number(m[6])
    } else {
      value = sign * Number((m[7] ?? '').replace(/,/g, ''))
    }
    if (!Number.isFinite(value)) continue

    let unit: string | undefined
    let dim: Dim | undefined
    let error: string | undefined

    if (symbol) {
      unit = SYMBOL_TO_CURRENCY[symbol] ?? symbol
      dim = 'currency'
    } else if (isComposite) {
      unit = 'in'
      dim = 'length'
    } else {
      const hit = matchUnitAt(input, re.lastIndex)
      if (hit) {
        unit = hit.canonical
        dim = hit.dim
      } else {
        let p = re.lastIndex
        while (p < input.length && /\s/.test(input[p])) p++
        const c = input[p]
        if (c !== undefined && /[A-Za-zμµ°]/.test(c)) {
          error = '无法识别单位'
        } else if (c === '.' && /[0-9]/.test(input[p + 1] ?? '')) {
          error = '数字格式异常'
        }
      }
    }

    tokens.push({ raw: m[0], value, unit, dim, symbol, error })
  }
  return tokens
}
