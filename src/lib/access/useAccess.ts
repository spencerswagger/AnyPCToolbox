import { ref } from 'vue'
import { resolveAccessConfig } from './config.ts'
import { verifyPasscode } from './verify.ts'

const STORAGE_KEY = 'anypctoolbox.access'

interface StoredSession {
  unlocked: boolean
  fingerprint: string
  unlockedAt: number
}

export function parseStoredSession(raw: string | null, expectedFingerprint: string): boolean {
  if (raw === null) return false
  try {
    const s = JSON.parse(raw) as Partial<StoredSession>
    return s.unlocked === true && s.fingerprint === expectedFingerprint
  } catch {
    return false
  }
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStorage(session: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {}
}

function removeStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function currentFingerprint(): string {
  return resolveAccessConfig().hash.slice(0, 8)
}

const unlocked = ref(parseStoredSession(readStorage(), currentFingerprint()))

async function unlock(passcode: string): Promise<boolean> {
  const ok = await verifyPasscode(passcode)
  if (!ok) return false
  unlocked.value = true
  writeStorage({ unlocked: true, fingerprint: currentFingerprint(), unlockedAt: Date.now() })
  return true
}

function lock(): void {
  unlocked.value = false
  removeStorage()
}

function canSee(hidden?: boolean): boolean {
  return hidden !== true ? true : unlocked.value
}

const hasHiddenTools = resolveAccessConfig().enabled

export function useAccess() {
  return { unlocked, unlock, lock, canSee, hasHiddenTools }
}
