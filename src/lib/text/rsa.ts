// WebCrypto RSA-OAEP 封装（纯异步函数；失败返回 { ok:false, error }）
// 生成密钥对（PEM）、公钥加密、私钥解密

export type RsaResult = { ok: true; value: string } | { ok: false; error: string }

const err = (error: string): RsaResult => ({ ok: false, error })

const ALG: RsaHashedKeyGenParams = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

function bufToB64(buf: ArrayBuffer): string {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin)
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
function bufToPem(buf: ArrayBuffer, label: string): string {
  const b64 = bufToB64(buf)
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`
}
function pemToBuf(pem: string, label: string): ArrayBuffer {
  const body = pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s+/g, '')
  return b64ToBytes(body).buffer
}

export interface RsaKeypair {
  publicPem: string
  privatePem: string
}

/** 生成 RSA-OAEP 密钥对，返回 PEM 形式 */
export async function rsaGenerate(bits: number): Promise<RsaKeypair> {
  const keypair = await crypto.subtle.generateKey(
    { ...ALG, modulusLength: bits },
    true,
    ['encrypt', 'decrypt'],
  )
  const spki = await crypto.subtle.exportKey('spki', keypair.publicKey)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keypair.privateKey)
  return { publicPem: bufToPem(spki, 'PUBLIC KEY'), privatePem: bufToPem(pkcs8, 'PRIVATE KEY') }
}

/** 使用公钥 PEM 加密任意长度文本（自动按密钥分组，RSA-OAEP） */
export async function rsaEncrypt(text: string, publicPem: string): Promise<RsaResult> {
  if (!hasCrypto()) return err('RSA 不可用：当前环境无 WebCrypto')
  if (!publicPem.trim()) return err('RSA 加密失败：缺少公钥')
  try {
    const key = await crypto.subtle.importKey('spki', pemToBuf(publicPem, 'PUBLIC KEY'), ALG, false, ['encrypt'])
    const maxChunk = Math.floor((key.algorithm as RsaKeyAlgorithm).modulusLength! / 8) - 2 * 32 - 2 // RSA-OAEP/SHA-256 每块最大明文
    const plain = utf8(text)
    const parts: string[] = []
    for (let i = 0; i < plain.length; i += maxChunk) {
      const enc = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, plain.subarray(i, i + maxChunk))
      parts.push(bufToB64(enc))
    }
    return { ok: true, value: parts.join('\n') }
  } catch {
    return err('RSA 加密失败：公钥无效或输入过长')
  }
}

/** 使用私钥 PEM 解密（支持多分组换行拼接的密文） */
export async function rsaDecrypt(b64: string, privatePem: string): Promise<RsaResult> {
  if (!hasCrypto()) return err('RSA 不可用：当前环境无 WebCrypto')
  if (!privatePem.trim()) return err('RSA 解密失败：缺少私钥')
  try {
    const key = await crypto.subtle.importKey('pkcs8', pemToBuf(privatePem, 'PRIVATE KEY'), ALG, false, ['decrypt'])
    const groups = b64.split(/\s+/).filter(Boolean)
    const parts: number[] = []
    for (const g of groups) {
      const dec = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, b64ToBytes(g))
      parts.push(...new Uint8Array(dec))
    }
    return { ok: true, value: new TextDecoder().decode(new Uint8Array(parts)) }
  } catch {
    return err('RSA 解密失败：私钥错误或密文损坏')
  }
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}