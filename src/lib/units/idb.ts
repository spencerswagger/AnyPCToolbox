// 极简 IndexedDB 封装：存汇率快照（key units:rates，TTL 24h）
import type { Rates } from './money.ts'

const DB_NAME = 'anypctoolbox'
const DB_VERSION = 1
const STORE = 'kv'
const KEY = 'units:rates'
const TTL_MS = 24 * 60 * 60 * 1000

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读缓存汇率：存在且未超 TTL 才返回；任何异常静默返回 null */
export async function readCachedRates(): Promise<Rates | null> {
  try {
    const v = await idbGet<Rates>(KEY)
    if (!v || typeof v._fetchedAt !== 'number') return null
    if (Date.now() - v._fetchedAt > TTL_MS) return null
    return v
  } catch {
    return null
  }
}

/** 写缓存汇率（带抓取时间戳）；失败静默 */
export async function writeCachedRates(rates: Rates): Promise<void> {
  try {
    await idbSet(KEY, { ...rates, _fetchedAt: Date.now() })
  } catch {
    // 静默
  }
}
