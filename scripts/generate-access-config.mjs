// 访问控制配置生成脚本：读取 ACCESS_CODE 生成 src/generated/access-config.ts
// 运行：node scripts/generate-access-config.mjs（由 predev/prebuild 自动执行）
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, 'src/generated/access-config.ts')

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8')
    const vars = {}
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let value = m[2]
      if (!value.startsWith('"') && !value.startsWith("'")) {
        value = value.replace(/\s*#.*$/, '')
      }
      value = value.trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      vars[m[1]] = value
    }
    return vars
  } catch {
    return {}
  }
}

const envLocal = loadEnvLocal()

function readVar(name) {
  const fromEnv = process.env[name]
  if (fromEnv !== undefined) return fromEnv
  return envLocal[name] ?? ''
}

const passcode = readVar('ACCESS_CODE').trim()

const TYPE_AND_VALUE = `export interface AccessConfig {
  version: 1
  enabled: boolean
  salt: string
  hash: string
}

export const accessConfig: AccessConfig = {
  version: 1,
  enabled: %ENABLED%,
  salt: '%SALT%',
  hash: '%HASH%',
}
`

let output
if (passcode === '') {
  output = TYPE_AND_VALUE.replaceAll('%ENABLED%', 'false').replaceAll('%SALT%', '').replaceAll('%HASH%', '')
} else {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + passcode).digest('hex')
  output = TYPE_AND_VALUE.replaceAll('%ENABLED%', 'true').replaceAll('%SALT%', salt).replaceAll('%HASH%', hash)
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, output)
console.log(passcode === '' ? 'access-config.ts: disabled（未配置密码）' : 'access-config.ts: enabled（已配置密码）')
