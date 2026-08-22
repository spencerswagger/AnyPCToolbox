// WebCrypto AES-GCM 封装（纯异步函数；失败返回 { ok:false, error }）

export type AesResult = { ok: true; value: string } | { ok: false; error: string }

const err = (error: string): AesResult => ({ ok: false, error })
const HASH = 'SHA-256'

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

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: HASH },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

/** 加密：text + 口令 → Base64(iv|密文)。iv 参数可填 Base64，默认随机 12 字节 */
export async function aesEncrypt(text: string, password: string, ivB64 = ''): Promise<AesResult> {
  if (!hasCrypto()) return err('AES 不可用：当前环境无 WebCrypto')
  if (!password) return err('AES 加密失败：缺少密钥')
  try {
    const iv = ivB64.trim() ? b64ToBytes(ivB64.trim()).slice(0, 12) : crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, iv)
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(text))
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
export async function aesDecrypt(b64: string, password: string): Promise<AesResult> {
  if (!hasCrypto()) return err('AES 不可用：当前环境无 WebCrypto')
  if (!password) return err('AES 解密失败：缺少密钥')
  try {
    const packed = b64ToBytes(b64.trim())
    if (packed.length < 13) return err('AES 解密失败：数据过短')
    const iv = packed.slice(0, 12)
    const cipher = packed.slice(12)
    const key = await deriveKey(password, iv)
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return { ok: true, value: new TextDecoder().decode(new Uint8Array(dec)) }
  } catch {
    return err('AES 解密失败：密钥错误或数据损坏')
  }
}