// preview.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-preview.ts
import { batchPreview, type FileEntry2 } from '../src/lib/rename/preview.ts'
import type { Rule } from '../src/lib/rename/rules.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

const files: FileEntry2[] = [
  { name: 'IMG_001.jpg', mtime: new Date('2026-08-22T10:30:00').getTime(), handle: null },
  { name: 'IMG_002.png', mtime: new Date('2026-08-22T10:30:00').getTime(), handle: null },
]

console.log('基本替换')
const rules: Rule[] = [{ type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false }]
const rows = batchPreview(files, rules)
check('行数', rows.length === 2)
check('新旧完整名', rows[0].old === 'IMG_001.jpg' && rows[0].new === 'Photo_001.jpg')
check('changed', rows[0].changed === true)
check('保留扩展名', rows[1].new === 'Photo_002.png')

console.log('extend 规则')
const extRule: Rule = { type: 'extension', mode: 'replace', ext: 'txt' }
const rows2 = batchPreview(files, [extRule])
check('替换扩展名', rows2[0].new === 'IMG_001.txt')

console.log('冲突')
const clashFiles: FileEntry2[] = [
  { name: 'a.jpg', mtime: 0, handle: null },
  { name: 'b.jpg', mtime: 0, handle: null },
]
const clash = batchPreview(clashFiles, [{ type: 'replace', find: 'b', with: 'a', onlyFirst: false, regex: false }])
check('冲突标记', clash[1].conflict === true)

console.log('扩展名：空 replace 不删扩展名(未激活)')
const keepExt = batchPreview([{ name: 'a.jpg', mtime: 0, handle: null }], [{ type: 'extension', mode: 'replace', ext: '' }])
check('空 replace 保留原扩展名', keepExt[0].new === 'a.jpg' && keepExt[0].changed === false)

console.log('autoNumber')
const an = batchPreview(clashFiles, [{ type: 'replace', find: 'b', with: 'a', onlyFirst: false, regex: false }], { autoNumber: true })
check('自动补序号消解', an.map((r) => r.new).join(',') === 'a.jpg,a (2).jpg')
check('补序后无冲突', an.every((r) => r.conflict === false))

console.log('invalid 隔离')
const invFiles: FileEntry2[] = [
  { name: 'b1.jpg', mtime: 0, handle: null },
  { name: 'b2.jpg', mtime: 0, handle: null },
]
const inv = batchPreview(invFiles, [{ type: 'replace', find: 'b', with: 'x<', onlyFirst: false, regex: false }])
check('invalid 名被标非法', inv[0].invalid === '含非法字符')
check('invalid 行不标冲突', inv[0].conflict === false && inv[1].conflict === false)

console.log('splitName')
const s2 = batchPreview([{ name: 'a.tar.gz', mtime: 0, handle: null }], [{ type: 'extension', mode: 'replace', ext: 'py' }])
check('多扩展名替换最后一段', s2[0].new === 'a.tar.py')

console.log('空文件列表')
check('空数组', batchPreview([], []).length === 0)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
