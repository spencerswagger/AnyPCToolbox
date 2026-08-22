// 单位换算核心逻辑自检脚本（设计文档约定的验证方式，非单元测试框架）
// 运行：node scripts/verify-units.ts
import { tokenize } from '../src/lib/units/lexer.ts'
import { equivalentsFor, formatValue, mergeTokens } from '../src/lib/units/convert.ts'
import { equivalentCurrencies, type Rates } from '../src/lib/units/money.ts'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let rates: Rates | null = null
try {
  rates = JSON.parse(readFileSync(join(here, '../src/data/rates.json'), 'utf8')) as Rates
} catch {
  // 允许缺快照：货币快照断言会跳过
}

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(b))
}

function single(text: string) {
  const t = tokenize(text)
  if (t.length !== 1) {
    throw new Error(`期望 1 个片段，实际 ${t.length}：${JSON.stringify(t)}`)
  }
  return t[0]
}

console.log('词法')
const t30 = single('30kg')
check('30kg → 数值 30', t30.value === 30)
check('30kg → 单位 kg', t30.unit === 'kg')
check('30kg → 量纲 weight', t30.dim === 'weight')

const tDollar = single('$1.99')
check('$1.99 → 数值 1.99', tDollar.value === 1.99)
check('$1.99 → 币种 USD', tDollar.unit === 'USD')
check('$1.99 → 量纲 currency', tDollar.dim === 'currency')

const tH = single('2h')
check('2h → 单位 h / time', tH.unit === 'h' && tH.dim === 'time')

const tComp = single("5'9\"")
check("5'9\" → 69 in", tComp.value === 69 && tComp.unit === 'in' && tComp.dim === 'length', String(tComp.value))

const tFrac = single('1/2')
check('1/2 → 0.5', near(tFrac.value ?? 0, 0.5))

const tThou = single('1,000')
check('1,000 → 1000', tThou.value === 1000)

const tSci = single('1e3')
check('1e3 → 1000', tSci.value === 1000)

const tNeg = single('-5℃')
check('-5℃ → 数值 -5 / 温度 ℃', tNeg.value === -5 && tNeg.unit === '℃' && tNeg.dim === 'temperature')

const tBare = single('42')
check('42 无单位', tBare.value === 42 && tBare.unit === undefined)

const tSpace = single('30 kg')
check('30 kg（带空格）→ kg', tSpace.unit === 'kg')

const tPost = single('100 CNY')
check('100 CNY（后置词）→ currency', tPost.unit === 'CNY' && tPost.dim === 'currency')

const err = tokenize('1.2.3').find((t) => t.error)
check('1.2.3 → 无法识别', Boolean(err), err?.error)

const multi = tokenize('30kg 和 $1.99')
check('多片段 30kg 和 $1.99 → 2 段', multi.length === 2 && multi[0].dim === 'weight' && multi[1].dim === 'currency', String(multi.length))

console.log('量纲换算')
const mi = equivalentsFor(single('1 mi'))!
check('1 mi → 1609.344 m', near(mi.equivalents.find((e) => e.unit === 'm')?.value ?? 0, 1609.344))
check('1 mi 量纲 length', mi.dim === 'length')

const jin = equivalentsFor(single('1 斤'))!
check('1 斤 → 500 g', near(jin.equivalents.find((e) => e.unit === 'g')?.value ?? 0, 500))
check('1 斤 → 0.5 kg', near(jin.equivalents.find((e) => e.unit === 'kg')?.value ?? 0, 0.5))

const gb = equivalentsFor(single('1 GB'))!
check('1 GB → 1000 MB', near(gb.equivalents.find((e) => e.unit === 'MB')?.value ?? 0, 1000))
check('1 GB → 1e9 B', near(gb.equivalents.find((e) => e.unit === 'B')?.value ?? 0, 1e9))

console.log('温度（基于公式换算）')
const c = equivalentsFor(single('100℃'))!
check('100℃ → 212℉', near(c.equivalents.find((e) => e.unit === '℉')?.value ?? 0, 212))
check('100℃ → 373.15K', near(c.equivalents.find((e) => e.unit === 'K')?.value ?? 0, 373.15))
check('100℃ 标注基于公式换算', c.note === '基于公式换算')
const f = equivalentsFor(single('212℉'))!
check('212℉ round-trip → 100℃', near(f.equivalents.find((e) => e.unit === '℃')?.value ?? 0, 100))

console.log('面积 / 体积 / 时间')
const mu = equivalentsFor(single('1 亩'))!
check('1 亩 → 666.67 ㎡', near(mu.equivalents.find((e) => e.unit === '㎡')?.value ?? 0, 2000 / 3))
const gal = equivalentsFor(single('1 gal'))!
check('1 gal → 3.7854 L', near(gal.equivalents.find((e) => e.unit === 'L')?.value ?? 0, 3.785411784))
const wk = equivalentsFor(single('1 week'))!
check('1 week → 7 day', near(wk.equivalents.find((e) => e.unit === 'day')?.value ?? 0, 7))
check('1 week → 604800 s', near(wk.equivalents.find((e) => e.unit === 's')?.value ?? 0, 604800))

console.log('数值展示')
check('formatValue(3e8) → 300000000', formatValue(3e8) === '300000000', formatValue(3e8))
check('formatValue(1000) → 1000', formatValue(1000) === '1000')
check('formatValue(1/3) → 0.333333', formatValue(1 / 3) === '0.333333', formatValue(1 / 3))
check('formatValue(1e-9) → 0.000000001', formatValue(1e-9) === '0.000000001', formatValue(1e-9))

console.log('同量纲连续片段合并')
const mTime = mergeTokens(tokenize('3min20s'))
check('3min20s → 1 段', mTime.length === 1, String(mTime.length))
check('3min20s → 合计 200s', mTime[0].unit === 'min' && near((mTime[0].value ?? 0) * 60, 200), JSON.stringify(mTime[0]))
check('3min20s → raw 合并为 3min20s', mTime[0].raw === '3min20s', mTime[0].raw)
const mT = mergeTokens(tokenize('3t200kg'))
check('3t200kg → 合计 3200kg', mT[0].unit === 't' && near((mT[0].value ?? 0) * 1000, 3200), JSON.stringify(mT[0]))
check('3t200kg → raw 合并为 3t200kg', mT[0].raw === '3t200kg', mT[0].raw)
const mMix = mergeTokens(tokenize('30kg 和 $1.99'))
check('不同量纲不合并 → 2 段', mMix.length === 2, String(mMix.length))
const mTemp = mergeTokens(tokenize('100℃20℃'))
check('温度不合并 → 2 段', mTemp.length === 2, String(mTemp.length))
if (rates) {
  const mUsd = mergeTokens(tokenize('$3 $5'), rates)
  check('$3 $5 → 合并 8 USD', mUsd.length === 1 && near(mUsd[0].value ?? 0, 8), JSON.stringify(mUsd[0]))
}

console.log('货币')
if (rates) {
  const usdTok = single('$1.99')
  const usdEq = equivalentsFor(usdTok, rates)!
  const cny = usdEq.equivalents.find((e) => e.unit === 'CNY')
  check('$1.99 → CNY 用快照汇率', Boolean(cny && near(cny.value, 1.99 * (rates.rates.CNY ?? 0))), String(cny?.value))

  const y100 = single('¥100')
  check('¥100 → 币种 CNY', y100.unit === 'CNY' && y100.dim === 'currency')
  const yEq = equivalentsFor(y100, rates)!
  const usd = yEq.equivalents.find((e) => e.unit === 'USD')
  check('¥100 → USD 用快照汇率', Boolean(usd && near(usd.value, 100 / (rates.rates.CNY ?? 1))), String(usd?.value))

  const jpy100 = single('JP¥100')
  check('JP¥100 → 币种 JPY', jpy100.unit === 'JPY' && jpy100.dim === 'currency')
  const jpEq = equivalentsFor(jpy100, rates)!
  const usd2 = jpEq.equivalents.find((e) => e.unit === 'USD')
  check('JP¥100 → USD 用快照汇率', Boolean(usd2 && near(usd2.value, 100 / (rates.rates.JPY ?? 1))), String(usd2?.value))
} else {
  console.log('  ⚠ 无 rates.json，跳过货币快照断言（Task 6 后再跑）')
}

console.log('货币：无汇率数据标注')
const noRates = equivalentCurrencies(7, 'CNY', null)
check('无快照 → 全部标注无汇率数据', noRates.length === 10 && noRates.every((e) => e.noRate === true))
const partial: Rates = { base: 'USD', rates: { USD: 1, CNY: 7 } }
const withMissing = equivalentCurrencies(7, 'CNY', partial)
check('缺 JPY 数据 → JPY 标注无汇率数据', Boolean(withMissing.find((e) => e.unit === 'JPY')?.noRate))
const usdItem = withMissing.find((e) => e.unit === 'USD')
check('有 USD 数据 → 正常换算 1 USD', Boolean(usdItem && near(usdItem.value, 1)), String(usdItem?.value))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
