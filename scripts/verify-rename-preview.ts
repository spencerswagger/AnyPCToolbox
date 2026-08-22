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

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)