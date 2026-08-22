// diff.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-diff.ts
import { diffSegments } from '../src/lib/rename/diff.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('无差异')
check('identical -> same', diffSegments('IMG_001', 'IMG_001').length === 1 && diffSegments('IMG_001', 'IMG_001')[0].type === 'same')

console.log('前缀新增')
check('prefix add', diffSegments('IMG_001', '01_IMG_001').some((s) => s.type === 'add'))

console.log('增删并存')
check('has add', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'add'))
check('has del', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'del'))
check('has same', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'same'))
check('拼接还原新串', diffSegments('IMG_001', '01_IMG_00X').filter((s) => s.type !== 'del').map((s) => s.text).join('') === '01_IMG_00X')
check('全不同为 del+add 两段', diffSegments('a', 'b').length === 2)

console.log('顺序精确')
{
  const seq = diffSegments('ABXY', 'ACXZ').map((s) => `${s.type}:${s.text}`).join(',')
  const expected = 'same:A,del:B,add:C,same:X,del:Y,add:Z'
  check('回溯段顺序', seq === expected, seq)
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
