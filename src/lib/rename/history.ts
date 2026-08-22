// history.ts：撤销栈（IndexedDB）。目录句柄与文件句柄可被结构化克隆存储。
// DB: rename; store: history; keyPath: id（自增）

const DB_NAME = 'rename'
const STORE = 'history'

/** 一次应用的一组操作（对应一次"应用更改"） */
export interface HistoryBatch {
  id?: number
  time: number
  dir: FileSystemDirectoryHandle
  ops: { oldName: string; newName: string }[]
}

let db: IDBDatabase | null = null

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db)
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => { db = req.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function pushHistory(batch: HistoryBatch): Promise<number> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).add(batch)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function popHistory(): Promise<HistoryBatch | null> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const curReq = store.openCursor(null, 'prev')
    curReq.onsuccess = () => {
      const cur = curReq.result
      if (!cur) { resolve(null); return }
      const batch = cur.value as HistoryBatch
      cur.delete()
      tx.oncomplete = () => resolve(batch)
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function clearHistory(): Promise<void> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
