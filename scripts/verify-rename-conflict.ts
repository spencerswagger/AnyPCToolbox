// conflict.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-conflict.ts
import { flagConflicts, uniquify } from '../src/lib/rename/conflict.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('flagConflicts')
const names = ['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg']
const flags = flagConflicts(names)
check('重复的 a 标为冲突', flags[0] === true && flags[2] === true)
check('唯一项非冲突', flags[1] === false && flags[3] === false)
check('空数组', flagConflicts([]).length === 0)

console.log('uniquify')
const u = uniquify(['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg'])
check('去重后唯一', new Set(u).size === u.length)
check('保留首个为原名', u[0] === 'a.jpg' && u[2] === 'a (2).jpg')
check('非冲突项不变', u[1] === 'b.jpg' && u[3] === 'c.jpg')
const back = uniquify(['x', 'x', 'x'])
check('多重复依次递增', back[0] === 'x' && back[1] === 'x (2)' && back[2] === 'x (3)')

console.log('uniquify 边界')
check('与既有占位名碰撞', JSON.stringify(uniquify(['a.jpg', 'a (2).jpg', 'a.jpg'])) === JSON.stringify(['a.jpg', 'a (2).jpg', 'a (3).jpg']))
check('隐藏文件', JSON.stringify(uniquify(['.gitignore', '.gitignore'])) === JSON.stringify(['.gitignore', '.gitignore (2)']))
check('多扩展名', JSON.stringify(uniquify(['a.tar.gz', 'a.tar.gz'])) === JSON.stringify(['a.tar.gz', 'a.tar (2).gz']))
check('空串', JSON.stringify(uniquify(['', ''])) === JSON.stringify(['', ' (2)']))
check('空数组', JSON.stringify(uniquify([])) === JSON.stringify([]))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
