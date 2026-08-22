// 量纲内换算：单值 → 该量纲全部等价项；温度/货币特殊处理
import { DIM_LABEL, findUnit, UNITS, type Dim } from './registry.ts'
import { equivalentCurrencies, currencyName, hasRate, type Rates } from './money.ts'
import type { Token } from './lexer.ts'

export interface Equivalent {
  unit: string
  name: string
  value: number
  approx?: boolean
  /** 货币无汇率数据时置位 */
  noRate?: boolean
}

export interface EquivResult {
  dim: Dim
  dimLabel: string
  sourceUnit: string
  sourceName: string
  equivalents: Equivalent[]
  /** 附加说明：基于公式换算 / 近似 / 无汇率数据 */
  note?: string
}

/** 数值展示：保留至多 6 位有效数字，展开为十进制，不使用科学计数法 */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  if (v === 0) return '0'
  const n = Number(v.toPrecision(6))
  if (Number.isInteger(n)) return String(n)
  const a = Math.abs(n)
  let digits = 6 - Math.floor(Math.log10(a)) - 1
  if (digits < 0) digits = 0
  if (digits > 20) digits = 20
  return n.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** 合并同量纲连续片段为一项：以首片段单位为展示单位，按基准值求和（3min20s → 200s；3t200kg → 3200kg）；温度不合并 */
export function mergeTokens(tokens: Token[], rates?: Rates | null): Token[] {
  const out: Token[] = []
  for (const t of tokens) {
    const prev = out[out.length - 1]
    const frag = t.symbol ? t.raw : t.raw + (t.unit ?? '')
    if (
      !t.dim || t.dim === 'temperature' || !t.unit || t.value === undefined ||
      !prev || prev.dim !== t.dim || !prev.unit || prev.value === undefined
    ) {
      out.push({ ...t })
      continue
    }
    if (t.dim === 'currency') {
      const r = rates?.rates
      if (!r || typeof r[prev.unit] !== 'number' || r[prev.unit] <= 0 || typeof r[t.unit] !== 'number' || r[t.unit] <= 0) {
        out.push({ ...t })
        continue
      }
      const usd = prev.value / r[prev.unit] + t.value / r[t.unit]
      prev.value = usd * r[prev.unit]
    } else {
      const uPrev = findUnit(t.dim, prev.unit)
      const uCur = findUnit(t.dim, t.unit)
      if (!uPrev?.factor || !uCur?.factor) {
        out.push({ ...t })
        continue
      }
      prev.value = (prev.value * uPrev.factor + t.value * uCur.factor) / uPrev.factor
    }
    prev.raw = prev.merged ? prev.raw + frag : (prev.symbol ? prev.raw : prev.raw + (prev.unit ?? '')) + frag
    prev.merged = true
  }
  return out
}

/** 片段 → 该量纲全部等价项；无单位/量纲/无法换算返回 null */
export function equivalentsFor(
  tok: { value?: number; unit?: string; dim?: Dim },
  rates?: Rates | null,
): EquivResult | null {
  if (tok.dim === undefined || tok.unit === undefined || tok.value === undefined) return null

  if (tok.dim === 'currency') {
    const list = equivalentCurrencies(tok.value, tok.unit, rates ?? null)
    return {
      dim: 'currency',
      dimLabel: DIM_LABEL.currency,
      sourceUnit: tok.unit,
      sourceName: currencyName(tok.unit),
      equivalents: list,
      note: hasRate(tok.unit, rates) ? undefined : '无汇率数据',
    }
  }

  if (tok.dim === 'temperature') {
    const u = findUnit('temperature', tok.unit)
    if (!u?.toBase || !u.fromBase) return null
    const base = u.toBase(tok.value)
    return {
      dim: 'temperature',
      dimLabel: DIM_LABEL.temperature,
      sourceUnit: tok.unit,
      sourceName: u.name,
      equivalents: UNITS.temperature
        .filter((x) => x.canonical !== tok.unit)
        .map((x) => ({ unit: x.canonical, name: x.name, value: x.fromBase!(base) })),
      note: '基于公式换算',
    }
  }

  const u = findUnit(tok.dim, tok.unit)
  if (!u || u.factor === undefined) return null
  const base = tok.value * u.factor
  return {
    dim: tok.dim,
    dimLabel: DIM_LABEL[tok.dim],
    sourceUnit: tok.unit,
    sourceName: u.name,
    equivalents: UNITS[tok.dim]
      .filter((x) => x.canonical !== tok.unit)
      .map((x) => ({
        unit: x.canonical,
        name: x.name,
        value: x.factor === undefined ? 0 : base / x.factor,
        approx: x.approx,
      })),
  }
}
