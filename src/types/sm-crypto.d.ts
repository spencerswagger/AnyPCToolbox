declare module 'sm-crypto' {
  export const sm2: {
    generateKeyPairHex(): { publicKey: string; privateKey: string }
    doEncrypt(msg: string, publicKey: string, cipherMode?: number): string
    doDecrypt(cipher: string, privateKey: string, cipherMode?: number): string
    doSignature(msg: string, privateKey: string, options?: Record<string, unknown>): string
    doVerifySignature(msg: string, signature: string, publicKey: string, options?: Record<string, unknown>): boolean
  }
  export const sm3: (input: string, options?: Record<string, unknown>) => string
  export const sm4: {
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
}