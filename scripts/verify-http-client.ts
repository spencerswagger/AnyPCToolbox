// HTTP 调试器核心逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-http-client.ts
import { extractPlaceholders, resolveVars, replaceAll, collectSnippet } from '../src/lib/debugger/variables.ts'
import { buildRequest } from '../src/lib/debugger/builder.ts'
import { parseResponse } from '../src/lib/debugger/parse.ts'
import { toCellView } from '../src/lib/debugger/renderers.ts'

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

console.log('请求构造')
const req = buildRequest(
  {
    id: '1', protocol: 'http', name: 'g', method: 'GET', urlTemplate: 'https://x.com/u/{{id}}',
    query: [{ key: 'page', value: '{{page}}' }, { key: 'q', value: 'a b' }],
    headers: [{ key: 'Auth', value: 'Bearer {{token}}' }],
    bodyType: 'json', bodyText: '{"id":"{{id}}"}',
    variables: [], parse: { listPath: '', columns: [] }, updatedAt: 0,
  },
  { id: '42', page: '1', token: 'T' },
)
check('URL 模板替换 + 追加 query（且 query 值编码空格）', req.url === 'https://x.com/u/42?page=1&q=a%20b', req.url)
check('Header 值替换', req.headers[0]?.[1] === 'Bearer T')
check('JSON body 替换', req.body === '{"id":"42"}')
check('json 类型默认注入 Content-Type', req.headers.some(([k]) => k.toLowerCase() === 'content-type'))

const noBody = buildRequest(
  { id: '1', protocol: 'http', name: 'g', method: 'POST', urlTemplate: 'https://x.com', query: [], headers: [], bodyType: 'none', bodyText: '', variables: [], parse: { listPath: '', columns: [] }, updatedAt: 0 },
  {},
)
check('bodyType none 不注入 Content-Type', !noBody.headers.some(([k]) => k.toLowerCase() === 'content-type'))

console.log('响应解析')
const raw = JSON.stringify({ code: 0, data: { list: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }], total: 2, page: 1 } })
const r = parseResponse(raw, { listPath: '$.data.list', totalPath: '$.data.total', pagePath: '$.data.page', columns: [] })
check('rows 命中列表', r.rows.length === 2, String(r.rows.length))
check('total 提取', r.total === 2, String(r.total))
check('page 提取', r.page === 1, String(r.page))
check('rows 元素保留原始字段', (r.rows[0] as { id: number }).id === 1)
const empty = parseResponse(raw, { listPath: '$.missing.path', columns: [] })
check('路径未命中 → rows 空', empty.rows.length === 0)
check('路径未命中 → 标记 ok:false', empty.ok === false)
check('topKeys 提供顶层键', Array.isArray(empty.topKeys) && empty.topKeys.includes('code'))
const bad = parseResponse('not json', { listPath: '$.list', columns: [] })
check('非法 JSON → error 提示', bad.ok === false && typeof bad.error === 'string')

console.log('单元格渲染')
const enumCol = { field: 's', title: '性别', type: 'enum' as const, enumMap: { '1': '男', '2': '女' } }
check('enum 1 → 男', toCellView(1, enumCol).text === '男')
check('enum 未命中 → 原文', toCellView(9, enumCol).text === '9')
const imgCol = { field: 'u', title: '图', type: 'image' as const }
check('image 判定为图片', toCellView('https://x.com/a.png', imgCol).kind === 'image')
const dtCol = { field: 't', title: '时间', type: 'datetime' as const }
check('datetime 秒级时间戳格式化', /2023/.test(toCellView(1693948800, dtCol).text), toCellView(1693948800, dtCol).text)
check('datetime 毫秒级时间戳格式化', /2023/.test(toCellView(1693948800000, dtCol).text))
const boolCol = { field: 'b', title: '启用', type: 'bool' as const }
check('bool true → 是', toCellView(true, boolCol).text === '是')
const linkCol = { field: 'l', title: '链', type: 'link' as const }
check('link 判定为链接', toCellView('https://x.com', linkCol).kind === 'link')
check('text 普通字符串', toCellView('hi', { field: 'x', title: 'x', type: 'text' as const }).kind === 'text')

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)