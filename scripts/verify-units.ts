// 单位换算核心逻辑自检脚本（设计文档约定的验证方式，非单元测试框架）
// 运行：node scripts/verify-units.ts
import { tokenize } from '../src/lib/units/lexer.ts'

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

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
