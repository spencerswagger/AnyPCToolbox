declare module 'sm-crypto' {
  interface Sm2 {
    generateKeyPairHex(): { publicKey: string; privateKey: string }
    doEncrypt(msg: string, publicKey: string, cipherMode?: number): string
    doDecrypt(cipher: string, privateKey: string, cipherMode?: number): string
    doSignature(msg: string, privateKey: string, options?: Record<string, unknown>): string
    doVerifySignature(msg: string, signature: string, publicKey: string, options?: Record<string, unknown>): boolean
  }
  interface Sm3 {
    (input: string, options?: Record<string, unknown>): string
  }
  interface Sm4 {
    encrypt(
      input: string,
      key: string,
      options?: { mode?: 'ecb' | 'cbc'; iv?: string; padding?: string; output?: string },
    ): string
    decrypt(
      input: string,
      key: string,
      options?: { mode?: 'ecb' | 'cbc'; iv?: string; padding?: string; output?: string },
    ): string
  }
  export const sm2: Sm2
  export const sm3: Sm3
  export const sm4: Sm4
  export default { sm2, sm3, sm4 }
}