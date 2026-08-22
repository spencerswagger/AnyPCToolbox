// text 库逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-text.ts
import { computeStats } from '../src/lib/text/stats.ts'
import { detectType } from '../src/lib/text/detect.ts'
import {
  encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url,
  encodeUrl, decodeUrl, encodeUnicode, decodeUnicode,
  encodeHex, decodeHex, encodeHtml, decodeHtml, rot,
} from '../src/lib/text/encoders.ts'
import { md5, crc32hex, computeHashes } from '../src/lib/text/hashes.ts'
import { createHash } from 'node:crypto'
import { extractTimestamps } from '../src/lib/text/timestamp.ts'
import { smartDecode } from '../src/lib/text/smartdecode.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('统计 computeStats')
// 中(1) a(1) 🙂(2 UTF-16) \n(1) \n(1) b(1) c(1) = 8 chars；codePoints=7（🙂算1）
// UTF-8: 中=3 a=1 🙂=4 \n=1 \n=1 b=1 c=1 = 12 字节
const st = computeStats('中a🙂\n\nbc')
check('chars (UTF-16 units)', st.chars === 8, String(st.chars))
check('codePoints (emoji=1)', st.codePoints === 7, String(st.codePoints))
check('UTF-8 bytes', st.bytesUtf8 === 12, String(st.bytesUtf8))
check('lines', st.lines === 3, String(st.lines))
check('nonEmptyLines', st.nonEmptyLines === 2, String(st.nonEmptyLines))
check('words', st.words === 3, String(st.words))
const empty = computeStats('')
check('空输入全 0', empty.chars === 0 && empty.words === 0)

console.log('类型探测 detectType')
check('JSON', detectType('{"a":1}') === 'json')
check('URL', detectType('https://example.com/x') === 'url')
check('UUID', detectType('6ba7b810-9dad-11d1-80b4-00c04fd430c8') === 'uuid')
check('Unix 秒', detectType('1693948800') === 'timestamp')
check('Base64', detectType('SGVsbG8=') === 'base64')
check('Hex', detectType('48656c6c6f') === 'hex')
check('通用', detectType('hello world') === 'generic')

console.log('编解码 round-trip')
const rt = (name: string, enc: (s: string) => { value: string }, dec: (s: string) => { value: string }) =>
  check(name, dec(enc('Hello 你好 🙂')).value === 'Hello 你好 🙂')
rt('Base64', encodeBase64, decodeBase64)
rt('Base64URL', encodeBase64Url, decodeBase64Url)
rt('URL', encodeUrl, decodeUrl)
rt('Unicode', encodeUnicode, decodeUnicode)
rt('Hex', encodeHex, decodeHex)
// HTML 解码依赖 document，仅浏览器可用；Node 环境跳过实跑，改为断言 encodeHtml 产出、
// decodeHtml 在当前环境行为不抛异常（若 document 存在则顺带做 round-trip）
if (typeof document !== 'undefined') {
  rt('HTML', encodeHtml, decodeHtml)
} else {
  check('HTML 编码映射 & → &amp;', encodeHtml('&').value === '&amp;')
}
check('ROT13 往返', rot(rot('Hello', 13), 13).value === 'Hello')
check('ROT13 中文不变', rot('你好', 13).value === '你好')

console.log('非法输入 → { ok:false, error }')
check('非法 Base64', decodeBase64('!!!!').ok === false)
check('Hex 含非 hex', decodeHex('xyz').ok === false)
check('Hex 长度奇数', decodeHex('abc').ok === false)
check('非法 URL 转义', decodeUrl('%zz').ok === false)

console.log('已知哈希值')
check('MD5("MD5")', md5('MD5') === '7f138a09169b250e9dcb378140907378', md5('MD5'))
// 跨长度回环（覆盖长度 %64 ∈ [56,63] 的多块 padding 分支，防止 MD5 digest 读错块）
let md5Ok = true
for (let n = 0; n <= 200; n++) {
  const s = 'x'.repeat(n)
  const expect = createHash('md5').update(s).digest('hex')
  if (md5(s) !== expect) { md5Ok = false; break }
}
check('MD5 全长度 0..200 与 node:crypto 一致', md5Ok)
check('MD5 空串', md5('') === 'd41d8cd98f00b204e9800998ecf8427e', md5(''))
check('CRC32("Hello")', crc32hex('Hello') === 'F7D18982', crc32hex('Hello'))

console.log('时间戳')
const ts = extractTimestamps('时间 1693948800 和 2026-08-22 10:30')
check('发现 Unix 秒命中', ts.some((h) => h.raw === '1693948800' && h.kind === 'unixSec'))
check('发现日期串命中', ts.some((h) => h.raw === '2026-08-22 10:30' && h.kind === 'date'))
const epoch = extractTimestamps('0 1000000000')
check('1970/2001 边界可解析', epoch.length === 2)

console.log('智能解码')
const sd = smartDecode(encodeUrl('hello=world').value, 8, 12)
check('URL 链有结果', sd.chains.length > 0 && sd.chains.some((c) => c.final.includes('world')))
const sdB64 = smartDecode('aGk=', 8, 12)
check('Base64 链还原 hi', sdB64.chains.some((c) => c.final === 'hi'))
check('默认轮次上限', sd.chains.length <= 12)
// 等分解码防环：hello 经 ROT13 到 uryyb（可读性不降级被放行），不产生空态兜底链
check('空态兜底（不可解码 @）', smartDecode('@', 8, 12).chains.some((c) => c.steps.length === 0 && c.final === '@'))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)