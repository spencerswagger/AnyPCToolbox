import { accessConfig, type AccessConfig } from '../../generated/access-config.ts'

export type { AccessConfig }

const SALT_RE = /^[0-9a-f]{32}$/
const HASH_RE = /^[0-9a-f]{64}$/

export function mergeAccessConfig(build: AccessConfig, override: unknown): AccessConfig {
  const o = override as Record<string, unknown> | null
  if (
    o !== null &&
    typeof o === 'object' &&
    o.version === 1 &&
    o.enabled === true &&
    typeof o.salt === 'string' &&
    SALT_RE.test(o.salt) &&
    typeof o.hash === 'string' &&
    HASH_RE.test(o.hash)
  ) {
    return { version: 1, enabled: true, salt: o.salt, hash: o.hash }
  }
  return build
}

export function resolveAccessConfig(): AccessConfig {
  const override = (globalThis as { __ACCESS_CODE_CONFIG__?: unknown }).__ACCESS_CODE_CONFIG__
  return mergeAccessConfig(accessConfig, override)
}
