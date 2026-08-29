// HTTP 调试器核心逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-http-client.ts
import { extractPlaceholders, resolveVars, replaceAll, collectSnippet } from '../src/lib/debugger/variables.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('占位符提取')
check('提取 url 中的 {{userId}}', extractPlaceholders(['/users/{{userId}}']).includes('userId'))
check('去重', extractPlaceholders(['{{a}}', '{{a}}', '{{b}}']).length === 2)
check('忽略花括号非占位符', extractPlaceholders(['{a}']).length === 0)
check('支持点号/横线', extractPlaceholders(['{{user.name}}', '{{x-y}}']).length === 2)

console.log('变量合并与替换')
const resolved = resolveVars([{ name: 'id', value: '42' }, { name: 'token', value: '' }], { token: 'SECRET' })
check('模板变量优先', resolved.id === '42')
check('模板空值回退全局', resolved.token === 'SECRET')
const g: Record<string, string> = {}
check('全局缺省为空字符串', resolveVars([{ name: 'x', value: '' }], g).x === '')
check('替换 {{id}} → 42', replaceAll('/users/{{id}}', { id: '42' }) === '/users/42')
check('未命中占位符原样保留', replaceAll('/u/{{nope}}', {}) === '/u/{{nope}}')
check('collectSnippet 串联各来源', collectSnippet({ urlTemplate: '/{{a}}', query: [{ key: 'k', value: '{{b}}' }], headers: [{ key: 'h', value: '{{c}}' }], bodyText: '{{d}}' }).includes('{{d}}'))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)