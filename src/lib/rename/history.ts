// history.ts：撤销栈（IndexedDB）。目录句柄与文件句柄可被结构化克隆存储。
// DB: rename; store: history; keyPath: id（自增）

const DB_NAME = 'rename'
const STORE = 'history'

/** 一次改名里的一条记录（旧->新） */
export interface RenameOp {
  dir: FileSystemDirectoryHandle
  oldName: string
  newName: string
}
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
  })
}

/** 返回最近的一次批（未消费则不移除） */
export async function peekHistory(): Promise<HistoryBatch | null> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.openCursor(null, 'prev')
    req.onsuccess = () => {
      const cur = req.result
      resolve(cur ? (cur.value as HistoryBatch) : null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function popHistory(): Promise<HistoryBatch | null> {
  const batch = await peekHistory()
  if (!batch || batch.id == null) return batch
  const d = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(batch.id!)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return batch
}

export async function clearHistory(): Promise<void> {
  const d = await open()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}