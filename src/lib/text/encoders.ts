// 单步编解码纯函数（Base64 / Base64URL / URL / Unicode / Hex / HTML / ROT）
// 每个函数返回 { ok: true, value } 或 { ok: false, error }，非法输入不抛错。

export type Result = { ok: true; value: string } | { ok: false; error: string }

const ok = (value: string): Result => ({ ok: true, value })
const err = (error: string): Result => ({ ok: false, error })

/* Base64 */
export function encodeBase64(input: string): Result {
  try {
    const bytes = new TextEncoder().encode(input)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return ok(btoa(bin))
  } catch {
    return err('Base64 编码失败')
  }
}
export function decodeBase64(input: string): Result {
  try {
    const bin = atob(input.replace(/\s+/g, ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return ok(new TextDecoder().decode(bytes))
  } catch {
    return err('Base64 解码失败：输入不是合法的 Base64')
  }
}

/* Base64URL */
function toB64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64Url(b64u: string): string {
  let s = b64u.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return s
}
export function encodeBase64Url(input: string): Result {
  const r = encodeBase64(input)
  return r.ok ? ok(toB64Url(r.value)) : r
}
export function decodeBase64Url(input: string): Result {
  return decodeBase64(fromB64Url(input.trim()))
}

/* URL 编码 */
export function encodeUrl(input: string): Result {
  try {
    return ok(encodeURIComponent(input))
  } catch {
    return err('URL 编码失败')
  }
}
export function decodeUrl(input: string): Result {
  try {
    return ok(decodeURIComponent(input))
  } catch {
    return err('URL 解码失败：无效的百分号转义')
  }
}

/* Unicode 转义 */
export function encodeUnicode(input: string): Result {
  let out = ''
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0)!
    out += cp > 0xffff ? toSurrogate(cp) : `\\u${cp.toString(16).padStart(4, '0')}`
  }
  return ok(out)
}
function toSurrogate(cp: number): string {
  const off = cp - 0x10000
  const hi = 0xd800 + (off >> 10)
  const lo = 0xdc00 + (off & 0x3ff)
  return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`
}
export function decodeUnicode(input: string): Result {
  const decoded = input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
  // 对含引号/反斜杠等做转义后 JSON 解析，得到真正的字面值
  try {
    return ok(JSON.parse(`"${decoded.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`))
  } catch {
    return err('Unicode 解码失败：无效的转义序列')
  }
}

/* Hex */
export function encodeHex(input: string): Result {
  const bytes = new TextEncoder().encode(input)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return ok(out)
}
export function decodeHex(input: string): Result {
  const s = input.replace(/\s+/g, '')
  if (s.length % 2 !== 0) return err('Hex 解码失败：长度必须为偶数')
  if (!/^[0-9a-fA-F]*$/.test(s)) return err('Hex 解码失败：包含非十六进制字符')
  const bytes = new Uint8Array(s.length / 2)
  for (let i = 0; i < s.length; i += 2) bytes[i / 2] = Number.parseInt(s.slice(i, i + 2), 16)
  return ok(new TextDecoder().decode(bytes))
}

/* HTML 实体（解码用 textarea 技巧；编码走转义映射） */
const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export function encodeHtml(input: string): Result {
  return ok(Array.from(input).map((c) => HTML_ESCAPE[c] ?? c).join(''))
}
export function decodeHtml(input: string): Result {
  try {
    const el = document.createElement('textarea')
    el.innerHTML = input
    return ok(el.value)
  } catch {
    return err('HTML 实体解码失败')
  }
}

/* ROT：A-Z/a-z 位移可选参数（默认 13） */
export function rot(input: string, shift = 13): Result {
  const k = ((shift % 26) + 26) % 26
  let out = ''
  for (const c of input) {
    const code = c.charCodeAt(0)
    let n = c
    if (code >= 65 && code <= 90) n = String.fromCharCode(((code - 65 + k) % 26) + 65)
    else if (code >= 97 && code <= 122) n = String.fromCharCode(((code - 97 + k) % 26) + 97)
    out += n
  }
  return ok(out)
}