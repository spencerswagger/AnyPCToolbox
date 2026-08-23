// 国密（sm.ts）逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-sm.ts
import {
  sm3Hash,
  sm4Encrypt,
  sm4Decrypt,
  sm4GenerateKey,
  sm2GenerateKeyPair,
  sm2Encrypt,
  sm2Decrypt,
  sm2Sign,
  sm2Verify,
  type Sm4Options,
} from '../src/lib/text/sm.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('SM3')
check("sm3('abc') 已知向量", sm3Hash('abc').ok && sm3Hash('abc').value === '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0', sm3Hash('abc').value)

console.log('SM4')
const sm4Key = '0123456789abcdeffedcba9876543210'
const sm4Msg = 'hello world! 我是 juneandgreen.'
const ecb: Sm4Options = { mode: 'ecb', ivHex: '', output: 'hex' }
const ecbB64: Sm4Options = { mode: 'ecb', ivHex: '', output: 'base64' }
const cbc: Sm4Options = { mode: 'cbc', ivHex: 'fedcba98765432100123456789abcdef', output: 'hex' }
const enc1 = sm4Encrypt(sm4Msg, sm4Key, ecb)
check('SM4 加密输出与官方示例密文一致', enc1.ok && enc1.value === '0e395deb10f6e8a17e17823e1fd9bd98a1bff1df508b5b8a1efb79ec633d1bb129432ac1b74972dbe97bab04f024e89c', enc1.value)
if (enc1.ok) check('SM4 ECB 解密往返', sm4Decrypt(enc1.value, sm4Key, ecb).ok && sm4Decrypt(enc1.value, sm4Key, ecb).value === sm4Msg)
const encB64 = sm4Encrypt(sm4Msg, sm4Key, ecbB64)
if (encB64.ok) check('SM4 Base64 输出可往返', sm4Decrypt(encB64.value, sm4Key, ecb).ok && sm4Decrypt(encB64.value, sm4Key, ecb).value === sm4Msg)
const enc2 = sm4Encrypt(sm4Msg, sm4Key, cbc)
if (enc2.ok) check('SM4 CBC 解密往返', sm4Decrypt(enc2.value, sm4Key, cbc).ok && sm4Decrypt(enc2.value, sm4Key, cbc).value === sm4Msg)
check('SM4 非法密钥(5字节) → ok:false', sm4Encrypt('x', '12345', ecb).ok === false)
check('SM4 CBC 缺 IV → ok:false', sm4Encrypt('x', sm4Key, { ...cbc, ivHex: '' }).ok === false)
check('SM4 随机密钥为 32 位 hex', /^[0-9a-f]{32}$/.test(sm4GenerateKey()))

console.log('SM2')
const kp = sm2GenerateKeyPair()
check('SM2 生成密钥对非空', kp.publicKey.length > 0 && kp.privateKey.length > 0)
const sm2Enc = sm2Encrypt('国密测试 hello', kp.publicKey)
if (sm2Enc.ok) check('SM2 加密→解密往返', sm2Decrypt(sm2Enc.value, kp.privateKey).ok && sm2Decrypt(sm2Enc.value, kp.privateKey).value === '国密测试 hello')
// 密文格式 C1C2C3（cipherMode 0）
const sm2Enc0 = sm2Encrypt('国密测试 hello', kp.publicKey, 0) as { ok: false } | { ok: true; value: string }
if (sm2Enc0.ok && sm2Enc.value !== sm2Enc0.value) check('SM2 C1C2C3 与 C1C3C2 密文不同', sm2Decrypt(sm2Enc0.value, kp.privateKey, 0).ok && sm2Decrypt(sm2Enc0.value, kp.privateKey, 0).value === '国密测试 hello')
if (sm2Enc.ok) check('SM2 密文格式不匹配 → 解密失败', sm2Decrypt(sm2Enc.value, kp.privateKey, 0).ok === false)

const sm2Sig = sm2Sign('待签名消息', kp.privateKey)
if (sm2Sig.ok) check('SM2 签名→验签通过', sm2Verify('待签名消息', sm2Sig.value, kp.publicKey).ok && sm2Verify('待签名消息', sm2Sig.value, kp.publicKey).value === '验签通过')
if (sm2Sig.ok) check('SM2 篡改消息→验签失败', sm2Verify('被篡改消息', sm2Sig.value, kp.publicKey).value === '验签失败')
check('SM2 缺公钥加密 → ok:false', sm2Encrypt('x', '').ok === false)
check('SM2 缺私钥解密 → ok:false', sm2Decrypt('00'.repeat(100), '').ok === false)

// DER 编码签名
const derSig = sm2Sign('DER 测试', kp.privateKey, { der: true })
check('SM2 DER 签名可验签', derSig.ok && sm2Verify('DER 测试', derSig.value, kp.publicKey, { der: true }).ok && sm2Verify('DER 测试', derSig.value, kp.publicKey, { der: true }).value === '验签通过')
if (derSig.ok) check('SM2 DER 与非 DER 签名不同', derSig.value !== sm2Sign('DER 测试', kp.privateKey).value)

// 自定义 userId 签名
const uidSig = sm2Sign('自定义用户', kp.privateKey, { userId: '0012345678901234' })
check('SM2 自定义 userId 签名可验签', uidSig.ok && (sm2Verify('自定义用户', uidSig.value, kp.publicKey, { userId: '0012345678901234' }).value ?? '') === '验签通过')
if (uidSig.ok) check('SM2 不同 userId 验签失败', sm2Verify('自定义用户', uidSig.value, kp.publicKey).value === '验签失败')

// 关闭杂凑（hash=false）
const noHashSig = sm2Sign('无杂凑', kp.privateKey, { hash: false })
check('SM2 关闭杂凑可验签', noHashSig.ok && sm2Verify('无杂凑', noHashSig.value, kp.publicKey, { hash: false }).value === '验签通过')
check('SM2 缺签名验签 → ok:false', sm2Verify('x', '', kp.publicKey).ok === false)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)