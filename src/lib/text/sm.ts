// 国密（SM2/SM3/SM4）封装：统一返回 { ok:true, value } | { ok:false, error }
// 算法库 sm-crypto（纯 JS，浏览器/Node 均可用）
import smcrypto from 'sm-crypto'
import { reactive } from 'vue'

const { sm2: _sm2, sm3: _sm3, sm4: _sm4 } = smcrypto

export type SmResult = { ok: true; value: string } | { ok: false; error: string }

const err = (error: string): SmResult => ({ ok: false, error })
const CIPHER_MODE = 1 // C1C3C2（GmSSL 标准）

// ---------- 字节工具 ----------
function hexToBytes(hex: string): Uint8Array {
  const t = hex.replace(/\s+/g, '')
  const bytes = new Uint8Array(t.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
  return bytes
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
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

// ---------- SM3 ----------
export function sm3Hash(text: string): SmResult {
  try {
    return { ok: true, value: _sm3(text) }
  } catch {
    return err('SM3 计算失败')
  }
}

// ---------- SM4 ----------
export type Sm4Mode = 'ecb' | 'cbc'
export type Sm4Output = 'hex' | 'base64'
export interface Sm4Options {
  mode: Sm4Mode
  ivHex: string // CBC 时必填，32 位 hex
  output: Sm4Output
}

function checkHex32(value: string, subject: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = value.replace(/\s+/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(t)) return err(`${subject}需为 32 位十六进制`)
  return { ok: true, value: t.toLowerCase() }
}

/** 密钥解析：接受 32 位 hex 或恰好 16 字节的 utf8 字符串，统一转为 16 字节 hex */
function resolveKey(key: string): { ok: true; value: string } | { ok: false; error: string } {
  const k = key.trim()
  if (!k) return err('SM4 解密失败：缺少密钥')
  if (/^[0-9a-fA-F]{32}$/.test(k)) return { ok: true, value: k.toLowerCase() }
  const bytes = new TextEncoder().encode(k)
  if (bytes.length !== 16) return err('SM4 密钥需为 32 位十六进制或恰好 16 字节的字符串')
  return { ok: true, value: bytesToHex(bytes) }
}

/** 生成 16 字节随机密钥，返回 32 位 hex */
export function sm4GenerateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return bytesToHex(bytes)
}

export function sm4Encrypt(text: string, key: string, opts: Sm4Options): SmResult {
  const k = resolveKey(key)
  if (!k.ok) return k
  let iv: string | undefined
  if (opts.mode === 'cbc') {
    const v = checkHex32(opts.ivHex, 'CBC IV')
    if (!v.ok) return v
    iv = v.value
  }
  try {
    const hex = _sm4.encrypt(text, k.value, { mode: opts.mode, iv })
    return { ok: true, value: opts.output === 'base64' ? bytesToB64(hexToBytes(hex)) : hex }
  } catch {
    return err('SM4 加密失败')
  }
}

export function sm4Decrypt(cipher: string, key: string, opts: Sm4Options): SmResult {
  const k = resolveKey(key)
  if (!k.ok) return k
  let hex = cipher.trim()
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    try {
      hex = bytesToHex(b64ToBytes(hex))
    } catch {
      return err('SM4 密文需为 hex 或 base64')
    }
  } else {
    hex = hex.toLowerCase()
  }
  let iv: string | undefined
  if (opts.mode === 'cbc') {
    const v = checkHex32(opts.ivHex, 'CBC IV')
    if (!v.ok) return v
    iv = v.value
  }
  try {
    const plain = _sm4.decrypt(hex, k.value, { mode: opts.mode, iv })
    return { ok: true, value: plain }
  } catch {
    return err('SM4 解密失败：密钥/IV 错误或密文损坏')
  }
}

// ---------- SM2 密钥对（加密/签名两面板共享）----------
export const sm2Keypair = reactive({ publicKey: '', privateKey: '' })

export function sm2GenerateKeyPair(): { publicKey: string; privateKey: string } {
  const kp = _sm2.generateKeyPairHex()
  sm2Keypair.publicKey = kp.publicKey
  sm2Keypair.privateKey = kp.privateKey
  return { ...kp }
}

export function sm2Encrypt(text: string, publicKey: string): SmResult {
  if (!publicKey.trim()) return err('SM2 加密失败：缺少公钥')
  try {
    return { ok: true, value: _sm2.doEncrypt(text, publicKey.trim(), CIPHER_MODE) }
  } catch {
    return err('SM2 加密失败：公钥无效')
  }
}

export function sm2Decrypt(cipher: string, privateKey: string): SmResult {
  if (!privateKey.trim()) return err('SM2 解密失败：缺少私钥')
  try {
    return { ok: true, value: _sm2.doDecrypt(cipher.trim(), privateKey.trim(), CIPHER_MODE) }
  } catch {
    return err('SM2 解密失败：密文或私钥无效')
  }
}

export function sm2Sign(text: string, privateKey: string): SmResult {
  if (!privateKey.trim()) return err('SM2 签名失败：缺少私钥')
  try {
    return { ok: true, value: _sm2.doSignature(text, privateKey.trim()) }
  } catch {
    return err('SM2 签名失败：私钥无效')
  }
}

export function sm2Verify(text: string, signatureHex: string, publicKey: string): SmResult {
  if (!signatureHex.trim()) return err('SM2 验签：缺少签名')
  if (!publicKey.trim()) return err('SM2 验签：缺少公钥')
  try {
    const pass = _sm2.doVerifySignature(text, signatureHex.trim(), publicKey.trim())
    return { ok: true, value: pass ? '验签通过' : '验签失败' }
  } catch {
    return err('SM2 验签失败：签名或公钥无效')
  }
}