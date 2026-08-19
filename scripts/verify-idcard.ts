// idcard.ts 逻辑自检脚本（设计文档约定的验证方式，非单元测试框架）
// 运行：node scripts/verify-idcard.ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checksum, upgrade15to18, normalizeId, parseId, generateIds } from '../src/lib/idcard.ts'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, '../src/data/china.json'), 'utf8'))
const areas = data.areas as Record<string, string>

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('校验位计算')
check('11010519491231002 → X', checksum('11010519491231002') === 'X')
check('44030419850615001 → 5', checksum('44030419850615001') === '5')

console.log('15 位转 18 位')
check('110105491231002 → 11010519491231002X', upgrade15to18('110105491231002') === '11010519491231002X')
check('440524800101001 → 440524198001010013', upgrade15to18('440524800101001') === '440524198001010013')

console.log('归一化')
check('小写 x 转大写', normalizeId('11010519491231002x').id === '11010519491231002X')
check('17 位数字 → 长度错误', normalizeId('11010519491231002').reason === '长度错误')
check('含字母 → 格式错误', normalizeId('11010519491231002a').reason === '格式错误')

console.log('解析：有效样例')
const a = parseId('11010519491231002X', areas)
check('valid', a.valid === true)
check('发证地 北京市朝阳区', a.sign === '北京市朝阳区', a.sign)
check('出生 1949-12-31', a.birthday === '1949-12-31')
check('性别 女', a.sex === '女')
check('年龄 ≥76', (a.age ?? 0) >= 76, String(a.age))

const b = parseId('440304198506150015', areas)
check('valid', b.valid === true)
check('发证地 广东省深圳市福田区', b.sign === '广东省深圳市福田区', b.sign)
check('性别 男', b.sex === '男')

console.log('解析：港澳台居住证')
const hmt = parseId('810000199001010019', areas)
check('类型 港澳台居民居住证', hmt.type === '港澳台居民居住证')
check('发证地 香港特别行政区', hmt.sign === '香港特别行政区', hmt.sign)
check('valid', hmt.valid === true)

console.log('解析：无效样例')
const badSum = parseId('110105194912310021', areas)
check('校验位错误', badSum.reason === '校验位错误' && badSum.valid === false)
const badDate = parseId('130102199902300036', areas)
check('非法日期（2月30日）', badDate.reason === '非法日期')
const unknown = parseId('999999199001010032', areas)
check('未知区划但保留生日', unknown.reason === '未知区划' && unknown.birthday === '1990-01-01')
const foreign = parseId('930000199001010019', areas)
check('暂不支持（93 开头）', foreign.reason === '暂不支持')
const badFormat = parseId('abc', areas)
check('格式错误', badFormat.reason === '格式错误')

console.log('批量生成')
const gen = generateIds({ count: 200, sex: '男', minAge: 20, maxAge: 30, areaCode: '440304' }, areas)
check('生成 200 条', gen.length === 200, String(gen.length))
check('批内无重复', new Set(gen).size === gen.length)
check('全部有效', gen.every((id) => parseId(id, areas).valid))
check('性别全部为男', gen.every((id) => parseId(id, areas).sex === '男'))
check('发证地全部含福田区', gen.every((id) => parseId(id, areas).sign.includes('福田区')))
check('年龄全部 20-30', gen.every((id) => { const age = parseId(id, areas).age ?? -1; return age >= 20 && age <= 30 }))
const genRandom = generateIds({ count: 50 }, areas)
check('随机生成 50 条全部有效', genRandom.length === 50 && genRandom.every((id) => parseId(id, areas).valid))
const genEmpty = generateIds({ count: 10, areaCode: '810000' }, areas)
check('港澳台无候选码返回空数组', genEmpty.length === 0)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
