// 访问控制（access）逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-access.ts
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mergeAccessConfig, type AccessConfig } from '../src/lib/access/config.ts'
import { sha256Hex, verifyPasscode } from '../src/lib/access/verify.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatedFile = resolve(root, 'src/generated/access-config.ts')

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

function runGenerator(accessCode: string): string {
  execSync('node scripts/generate-access-config.mjs', {
    cwd: root,
    env: { ...process.env, ACCESS_CODE: accessCode },
    stdio: 'pipe',
  })
  return readFileSync(generatedFile, 'utf8')
}

async function main() {
  const snapshot = existsSync(generatedFile) ? readFileSync(generatedFile, 'utf8') : null
  try {
    console.log('生成脚本')
    const content = runGenerator('test-pass-123')
    const salt = content.match(/salt: '([0-9a-f]{32})'/)?.[1] ?? ''
    const hash = content.match(/hash: '([0-9a-f]{64})'/)?.[1] ?? ''
    check('配置了 ACCESS_CODE → enabled: true', content.includes('enabled: true'))
    check('盐为 32 位 hex', salt !== '')
    const expected = createHash('sha256').update(salt + 'test-pass-123').digest('hex')
    check('hash = SHA-256(salt + 明文)', hash === expected, `${hash} vs ${expected}`)
    check('产物不含明文密码', !content.includes('test-pass-123'))

    console.log('配置解析')
    const build: AccessConfig = { version: 1, enabled: true, salt: 'a'.repeat(32), hash: 'b'.repeat(64) }
    const override = { version: 1, enabled: true, salt: 'c'.repeat(32), hash: 'd'.repeat(64) }
    check('override 合法 → 采用 override', mergeAccessConfig(build, override).hash === 'd'.repeat(64))
    check('override null → 回落 build', mergeAccessConfig(build, null) === build)
    check('override 非 enabled → 回落 build', mergeAccessConfig(build, { ...override, enabled: false }) === build)
    check('override 盐格式非法 → 回落 build', mergeAccessConfig(build, { ...override, salt: 'zz' }) === build)
    check('override 哈希格式非法 → 回落 build', mergeAccessConfig(build, { ...override, hash: 'yy' }) === build)

    console.log('密码验证')
    const enabled: AccessConfig = { version: 1, enabled: true, salt, hash }
    check('sha256Hex 已知向量', (await sha256Hex('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    check('正确密码 → true', await verifyPasscode('test-pass-123', enabled))
    check('错误密码 → false', !(await verifyPasscode('wrong-pass', enabled)))
    check('disabled 配置 → 恒 false', !(await verifyPasscode('test-pass-123', { ...enabled, enabled: false })))

    console.log('会话状态')
    const fingerprint = hash.slice(0, 8)
    const storageMap = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => { storageMap.set(k, v) },
        removeItem: (k: string) => { storageMap.delete(k) },
      },
      configurable: true,
    })
    const globalOverride = globalThis as { __ACCESS_CODE_CONFIG__?: unknown }
    globalOverride.__ACCESS_CODE_CONFIG__ = { version: 1, enabled: true, salt, hash }
    const { parseStoredSession, useAccess } = await import('../src/lib/access/useAccess.ts')

    check('parseStoredSession: null → false', parseStoredSession(null, fingerprint) === false)
    check('parseStoredSession: 非法 JSON → false', parseStoredSession('{bad', fingerprint) === false)
    check('parseStoredSession: 指纹失配 → false', parseStoredSession(JSON.stringify({ unlocked: true, fingerprint: 'ffffffff', unlockedAt: 0 }), fingerprint) === false)
    check('parseStoredSession: 匹配 → true', parseStoredSession(JSON.stringify({ unlocked: true, fingerprint, unlockedAt: 0 }), fingerprint) === true)

    const access = useAccess()
    check('初始未解锁', access.unlocked.value === false)
    check('canSee 公开工具', access.canSee() === true && access.canSee(false) === true)
    check('canSee 隐藏工具（未解锁）→ false', access.canSee(true) === false)
    check('hasHiddenTools 为 true', access.hasHiddenTools === true)
    check('错误密码 unlock → false', !(await access.unlock('wrong-pass')))
    check('正确密码 unlock → true', await access.unlock('test-pass-123'))
    check('解锁后 canSee 隐藏工具 → true', access.canSee(true) === true)
    check('会话已持久化', (storageMap.get('anypctoolbox.access') ?? '').includes(fingerprint))
    access.lock()
    check('锁定后未解锁', access.unlocked.value === false)
    check('锁定后 canSee 隐藏工具 → false', access.canSee(true) === false)
    check('锁定后会话已清除', storageMap.get('anypctoolbox.access') === undefined)

    const empty = runGenerator('')
    check('ACCESS_CODE 为空 → enabled: false', empty.includes('enabled: false'))
  } finally {
    if (snapshot !== null) {
      writeFileSync(generatedFile, snapshot)
    } else if (existsSync(generatedFile)) {
      unlinkSync(generatedFile)
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} 项检查失败`)
    process.exit(1)
  }
  console.log('\n全部通过')
}

main()
