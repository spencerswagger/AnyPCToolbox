// 哈希：SHA 系列走 WebCrypto；MD5 / CRC32 小型自实现（增量风格）。
// 对超大文本，MD5/CRC32 导出增量接口 update()/digest() 分块喂入避免卡顿。

export type ShaAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512'

export interface HashItem {
  id: string
  label: string
  value: string
  error?: string
}

const utf8Encoder = new TextEncoder()
const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** SHA-1/256/512，返回十六进制摘要（每次整体计算） */
export async function sha256(input: string, algo: ShaAlgo = 'SHA-256'): Promise<string> {
  const buf = await crypto.subtle.digest(algo, utf8Encoder.encode(input))
  return hex(buf)
}

/** 计算所有 SHA 变体 + MD5 + CRC32，返回按注册顺序排列的行 */
export async function computeHashes(input: string): Promise<HashItem[]> {
  const items: HashItem[] = [
    { id: 'md5', label: 'MD5', value: md5(input) },
    { id: 'crc32', label: 'CRC32', value: crc32hex(input) },
    { id: 'sha1', label: 'SHA-1', value: '' },
    { id: 'sha256', label: 'SHA-256', value: '' },
    { id: 'sha512', label: 'SHA-512', value: '' },
  ]
  try {
    items[2].value = await sha256(input, 'SHA-1')
    items[3].value = await sha256(input, 'SHA-256')
    items[4].value = await sha256(input, 'SHA-512')
  } catch {
    for (const it of items) {
      if (it.id.startsWith('sha') && !it.value) it.error = '计算失败'
    }
  }
  return items
}

/* ---- MD5（RFC 1321，增量接口） ---- */
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4,
  11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const K: number[] = (() => {
  const arr: number[] = []
  for (let i = 0; i < 64; i++) arr[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)
  return arr
})()

class Md5Ctx {
  a = 0x67452301
  b = 0xefcdab89
  c = 0x98badcfe
  d = 0x10325476
  len = 0
  pending = new Uint8Array(0)
  update(bytes: Uint8Array): void {
    const full = new Uint8Array(this.pending.length + bytes.length)
    full.set(this.pending, 0)
    full.set(bytes, this.pending.length)
    const n = Math.floor(full.length / 64) * 64
    for (let i = 0; i < n; i += 64) this.process(full.subarray(i, i + 64))
    this.pending = full.subarray(n)
    this.len += bytes.length
  }
  process(block: Uint8Array): void {
    let a = this.a,
      b = this.b,
      c = this.c,
      d = this.d
    const m = new DataView(block.buffer, block.byteOffset, block.byteLength)
    for (let i = 0; i < 64; i++) {
      let f: number, g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const t = (a + f + K[i] + m.getUint32(g * 4, true)) | 0
      a = d
      d = c
      c = b
      b = (b + rol32(t, S[i])) | 0
    }
    this.a = (this.a + a) | 0
    this.b = (this.b + b) | 0
    this.c = (this.c + c) | 0
    this.d = (this.d + d) | 0
  }
  digest(): string {
    const bitLen = this.len * 8
    let tail = new Uint8Array(this.pending.length + 1 + ((56 - ((this.pending.length + 1) % 64) + 64) % 64) + 8)
    tail.set(this.pending, 0)
    tail[this.pending.length] = 0x80
    const dv = new DataView(tail.buffer)
    dv.setUint32(tail.length - 8, bitLen >>> 0, true)
    dv.setUint32(tail.length - 4, Math.floor(bitLen / 0x100000000), true)
    // 复用 process()（内部用 block.byteOffset 正确读块），避免长度 %64 ∈ [56,63] 时读错数据
    for (let i = 0; i < tail.length; i += 64) {
      this.process(tail.subarray(i, i + 64))
    }
    return toHexLE([this.a, this.b, this.c, this.d])
  }
}

function rol32(x: number, s: number): number {
  return (x << s) | (x >>> (32 - s))
}
function toHexLE(ints: number[]): string {
  let out = ''
  for (const x of ints) {
    out += (x & 0xff).toString(16).padStart(2, '0')
    out += ((x >>> 8) & 0xff).toString(16).padStart(2, '0')
    out += ((x >>> 16) & 0xff).toString(16).padStart(2, '0')
    out += ((x >>> 24) & 0xff).toString(16).padStart(2, '0')
  }
  return out
}
/** 字符串 → MD5 hex（内部复用增量实现） */
export function md5(input: string): string {
  const ctx = new Md5Ctx()
  ctx.update(utf8Encoder.encode(input))
  return ctx.digest()
}

/* ---- CRC32（IEEE 802.3，增量接口） ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

class Crc32Ctx {
  crc = 0xffffffff
  update(bytes: Uint8Array): void {
    for (const byte of bytes) this.crc = CRC_TABLE[(this.crc ^ byte) & 0xff] ^ (this.crc >>> 8)
  }
  digest(): number {
    return (this.crc ^ 0xffffffff) >>> 0
  }
}
/** 字符串 → CRC32 hex（8 位大写） */
export function crc32hex(input: string): string {
  const ctx = new Crc32Ctx()
  ctx.update(utf8Encoder.encode(input))
  return ctx.digest().toString(16).padStart(8, '0').toUpperCase()
}