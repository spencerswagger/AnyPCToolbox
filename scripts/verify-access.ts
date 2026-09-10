// 访问控制（access）逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-access.ts
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  console.log('生成脚本')
  const content = runGenerator('test-pass-123')
  const salt = content.match(/salt: '([0-9a-f]{32})'/)?.[1] ?? ''
  const hash = content.match(/hash: '([0-9a-f]{64})'/)?.[1] ?? ''
  check('配置了 ACCESS_CODE → enabled: true', content.includes('enabled: true'))
  check('盐为 32 位 hex', salt !== '')
  const expected = createHash('sha256').update(salt + 'test-pass-123').digest('hex')
  check('hash = SHA-256(salt + 明文)', hash === expected, `${hash} vs ${expected}`)
  check('产物不含明文密码', !content.includes('test-pass-123'))

  const empty = runGenerator('')
  check('ACCESS_CODE 为空 → enabled: false', empty.includes('enabled: false'))

  if (failed > 0) {
    console.error(`\n${failed} 项检查失败`)
    process.exit(1)
  }
  console.log('\n全部通过')
}

main()
