// WebCrypto AES 封装（纯异步函数；失败返回 { ok:false, error }）
// 支持 模式（GCM/CBC）、密钥长度（128/256）、IV/Nonce（随机或固定 hex）

export type AesResult = { ok: true; value: string } | { ok: false; error: string }

export type AesMode = 'GCM' | 'CBC'

export interface AesOptions {
  mode: AesMode
  bits: 128 | 256
  /** IV/Nonce 来源：每次随机 或 固定 hex */
  ivMode: 'random' | 'fixed'
  /** ivMode='fixed' 时使用，hex 字符串 */
  ivHex: string
}

const err = (error: string): AesResult => ({ ok: false, error })
const HASH = 'SHA-256'
// GCM 推荐 12 字节 nonce；CBC 需要 16 字节 IV
const IV_LEN: Record<AesMode, number> = { GCM: 12, CBC: 16 }

const keyName = (mode: AesMode): string => (mode === 'GCM' ? 'AES-GCM' : 'AES-CBC')

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
function hexToBytes(hex: string): Uint8Array {
  const t = hex.replace(/\s+/g, '')
  if (!/^[0-9a-fA-F]*$/.test(t) || t.length % 2 !== 0) throw new Error('非法 hex')
  const bytes = new Uint8Array(t.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array, mode: AesMode, bits: 128 | 256): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: HASH },
    material,
    { name: keyName(mode), length: bits },
    false,
    ['encrypt', 'decrypt'],
  )
}

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

function resolveIv(opts: AesOptions): { iv: Uint8Array; error?: AesResult } {
  const ivLen = IV_LEN[opts.mode]
  if (opts.ivMode === 'fixed') {
    let iv: Uint8Array
    try {
      iv = hexToBytes(opts.ivHex || '')
    } catch {
      return { iv: new Uint8Array(), error: err(`IV/Nonce 需为合法的 ${ivLen * 2} 位十六进制`) }
    }
    if (iv.length !== ivLen) {
      return { iv, error: err(`${opts.mode} 的 IV/Nonce 需为 ${ivLen} 字节（${ivLen * 2} 位十六进制）`) }
    }
    return { iv }
  }
  return { iv: crypto.getRandomValues(new Uint8Array(ivLen)) }
}

/** 加密：text + 口令 → Base64(iv|密文)。IV 前缀存出（兼作 PBKDF2 盐） */
export async function aesEncrypt(text: string, password: string, opts: AesOptions): Promise<AesResult> {
  if (!hasCrypto()) return err('AES 不可用：当前环境无 WebCrypto')
  if (!password) return err('AES 加密失败：缺少密钥')
  const { iv, error } = resolveIv(opts)
  if (error) return error
  try {
    const key = await deriveKey(password, iv, opts.mode, opts.bits)
    const enc = await crypto.subtle.encrypt({ name: keyName(opts.mode), iv }, key, utf8(text))
    const cipher = new Uint8Array(enc)
    const packed = new Uint8Array(iv.length + cipher.length)
    packed.set(iv, 0)
    packed.set(cipher, iv.length)
    return { ok: true, value: bytesToB64(packed) }
  } catch {
    return err('AES 加密失败')
  }
}

/** 解密：Base64(iv|密文) + 口令 → 明文 */
export async function aesDecrypt(b64: string, password: string, opts: AesOptions): Promise<AesResult> {
  if (!hasCrypto()) return err('AES 不可用：当前环境无 WebCrypto')
  if (!password) return err('AES 解密失败：缺少密钥')
  try {
    const packed = b64ToBytes(b64.trim())
    const ivLen = IV_LEN[opts.mode]
    if (packed.length < ivLen + 1) return err('AES 解密失败：数据过短')
    const iv = packed.slice(0, ivLen)
    const cipher = packed.slice(ivLen)
    const key = await deriveKey(password, iv, opts.mode, opts.bits)
    const dec = await crypto.subtle.decrypt({ name: keyName(opts.mode), iv }, key, cipher)
    return { ok: true, value: new TextDecoder().decode(new Uint8Array(dec)) }
  } catch {
    return err('AES 解密失败：密钥错误、模式不匹配或数据损坏')
  }
}

/** 生成字节长度为 byteLen 的随机保密密钥，返回 base64（供「生成密钥」使用） */
export function generateSecret(byteLen: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLen))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}