// 量纲内换算：单值 → 该量纲全部等价项；温度/货币特殊处理
import { DIM_LABEL, findUnit, UNITS, type Dim } from './registry.ts'
import { equivalentCurrencies, currencyName, hasRate, type Rates } from './money.ts'

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

/** 数值展示：极端大/小用科学计数，其余保留至多 6 位有效数字 */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return v.toExponential(1)
  return String(Number(v.toPrecision(6)))
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
