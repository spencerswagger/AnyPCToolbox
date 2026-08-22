// build.ts 逻辑自检脚本（约定同 scripts/verify-idcard.ts）
// 运行：node scripts/verify-rename-build.ts
import { buildName, type BuildContext } from '../src/lib/rename/build.ts'
import { formatStamp } from '../src/lib/rename/rules.ts'
import type { Rule } from '../src/lib/rename/rules.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
const ctx: BuildContext = { index: 0, mtime: new Date('2026-08-22T10:30:00').getTime() }
const r = (rules: Rule[]): string => buildName('IMG_001', rules, ctx)
const capName = (mode: 'upper' | 'lower' | 'cap'): string =>
  buildName('img_001', [{ type: 'case', mode } as Rule], ctx)

console.log('查找-替换')
check('替换命中', r([{ type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false }]) === 'Photo_001')
check('替换未命中保持原名', r([{ type: 'replace', find: 'XYZ', with: 'A', onlyFirst: false, regex: false }]) === 'IMG_001')
check('仅首个', r([{ type: 'replace', find: '0', with: 'X', onlyFirst: true, regex: false }]) === 'IMG_X01')
check('全部替换', r([{ type: 'replace', find: '0', with: 'X', onlyFirst: false, regex: false }]) === 'IMG_XX1')

console.log('前缀/后缀')
check('前缀', r([{ type: 'prefix', text: '2025-' }]) === '2025-IMG_001')
check('后缀', r([{ type: 'suffix', text: '_final' }]) === 'IMG_001_final')

console.log('序号')
check('前置补零', r([{ type: 'sequence', start: 1, step: 1, width: 2, position: 'front', sep: '_' }]) === '01_IMG_001')
check('后置', r([{ type: 'sequence', start: 10, step: 2, width: 2, position: 'back', sep: '-' }]) === 'IMG_001-10')
const ctx2: BuildContext = { index: 2, mtime: ctx.mtime }
check('按 index 递增', buildName('a', [{ type: 'sequence', start: 1, step: 1, width: 2, position: 'back', sep: '_' }], ctx2) === 'a_03')

console.log('时间戳')
check('mtime 前位置', r([{ type: 'timestamp', format: 'YYYYMMDD', source: 'mtime', position: 'front', sep: '_' }]) === '20260822_IMG_001')
{
  const exp = formatStamp(Date.now(), 'YYYY-MM-DD')
  check('now 后位置', r([{ type: 'timestamp', format: 'YYYY-MM-DD', source: 'now', position: 'back', sep: '_' }]) === `IMG_001_${exp}`)
}

console.log('大小写')
check('全大写', capName('upper') === 'IMG_001')
check('全小写', capName('lower') === 'img_001')
check('首字母大写（仅首字母）', capName('cap') === 'Img_001')

console.log('删除字符')
check('删前4位', r([{ type: 'remove', mode: 'range', start: 1, count: 4, chars: '' }]) === '001')
check('删指定字符集', r([{ type: 'remove', mode: 'chars', start: 1, count: 1, chars: 'I' }]) === 'MG_001')

console.log('规则顺序生效')
check('先替换再前缀', r([
  { type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false },
  { type: 'prefix', text: 'id-' },
]) === 'id-Photo_001')

console.log('formatStamp')
check('YYYYMMDD', formatStamp(ctx.mtime, 'YYYYMMDD') === '20260822')
check('YYYY-MM-DD_HHmmss', formatStamp(ctx.mtime, 'YYYY-MM-DD_HHmmss') === '2026-08-22_103000')

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
