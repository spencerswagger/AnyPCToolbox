import type { AccessConfig } from '../../generated/access-config.ts'
import { resolveAccessConfig } from './config.ts'

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPasscode(input: string, config: AccessConfig = resolveAccessConfig()): Promise<boolean> {
  if (!config.enabled || input === '') return false
  return (await sha256Hex(config.salt + input)) === config.hash
}
