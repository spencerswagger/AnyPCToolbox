// 极简 IndexedDB 封装：HTTP 调试器的接口集合 / 历史 / 全局变量
// 结构：anypctoolbox 库 + kv store；每个逻辑集合存在一个 key 的对象 map 上（避免游标遍历）
import type { ApiRequest } from './model.ts'

const DB_NAME = 'anypctoolbox'
const STORE = 'kv'
const KEY_APIS = 'http:apis'
const KEY_GLOBALS = 'http:globals'
const HISTORY_PREFIX = 'http:history:'
export const HISTORY_CAP = 20

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

async function get<V>(key: string): Promise<V | null> {
  const db = await openDb()
  return new Promise<V | null>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as V | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- 接口集合：{ id: ApiRequest } ----
export async function getApis(): Promise<Record<string, ApiRequest>> {
  return (await get<Record<string, ApiRequest>>(KEY_APIS)) ?? {}
}
export async function saveApis(map: Record<string, ApiRequest>): Promise<void> {
  try { await set(KEY_APIS, map) } catch { /* 静默 */ }
}

// ---- 请求历史：key = http:history:<apiId>，数组，最新在前，截断 HISTORY_CAP ----
export interface HistoryEntry {
  ts: number
  status?: number
  ms: number
  size?: number
  raw?: string
  error?: string
  console: string
}
export async function getHistory(apiId: string): Promise<HistoryEntry[]> {
  return (await get<HistoryEntry[]>(`${HISTORY_PREFIX}${apiId}`)) ?? []
}
export async function pushHistory(apiId: string, entry: HistoryEntry): Promise<void> {
  const list = await getHistory(apiId)
  list.unshift(entry)
  try { await set(`${HISTORY_PREFIX}${apiId}`, list.slice(0, HISTORY_CAP)) } catch { /* 静默 */ }
}

// ---- 全局变量：{ name: value } ----
export type Globals = Record<string, string>
export async function getGlobals(): Promise<Globals> {
  return (await get<Globals>(KEY_GLOBALS)) ?? {}
}
export async function saveGlobals(g: Globals): Promise<void> {
  try { await set(KEY_GLOBALS, g) } catch { /* 静默 */ }
}