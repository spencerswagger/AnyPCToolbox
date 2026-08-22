// fsaccess.ts：File System Access API 的薄封装。
// 能力检测 -> 选夹 -> 遍历文件 -> 写盘改名 -> 回滚撤销。
import { pushHistory } from './history'

/** 环境是否支持 FS Access API（决定真写盘还是只读导出） */
export function detectFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export interface DirFileEntry {
  name: string
  size: number
  type: string
  mtime: number
  handle: FileSystemFileHandle
}

/** 弹出原生"选文件夹"对话框并收集目录下所有文件（非递归，仅当前层） */
export async function pickDirectory(): Promise<DirFileEntry[] | null> {
  if (!detectFsAccess()) return null
  try {
    const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker()
    return await collectDirFiles(dir)
  } catch {
    return null // 用户取消或出错
  }
}

async function collectDirFiles(dir: FileSystemDirectoryHandle): Promise<DirFileEntry[]> {
  const out: DirFileEntry[] = []
  for await (const [, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue
    const fh = handle as FileSystemFileHandle
    let size = 0
    let type = ''
    let mtime = 0
    try {
      const file = await fh.getFile()
      size = file.size
      type = file.type
      mtime = file.lastModified
    } catch { /* 读不到元信息仅设默认 */ }
    out.push({ name: fh.name, size, type, mtime, handle: fh })
  }
  return out
}

/** 未支持 FS API 时从 <input type=file multiple> 收集（只读模式） */
export function filesToEntries(files: FileList): DirFileEntry[] {
  return Array.from(files).map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    mtime: typeof f.lastModified === 'number' ? f.lastModified : Date.now(),
    handle: null as unknown as FileSystemFileHandle,
  }))
}

/**
 * 对目录应用改名：新柄建 -> 写旧文件字节 -> 删旧柄。
 * 返回失败的旧名列表；成功则记录到撤销栈。
 */
export async function commitRenames(
  dir: FileSystemDirectoryHandle,
  ops: { oldName: string; newName: string }[],
): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = []
  const applied: { oldName: string; newName: string }[] = []
  for (const op of ops) {
    if (op.oldName === op.newName) continue
    try {
      const oldHandle = await dir.getFileHandle(op.oldName)
      const file = await oldHandle.getFile()
      const newHandle: FileSystemFileHandle = await dir.getFileHandle(op.newName, { create: true })
      const w = await newHandle.createWritable()
      await w.write(file)
      await w.close()
      await dir.removeEntry(op.oldName)
      applied.push(op)
    } catch {
      // 尝试回滚本次已建的新柄
      try { await dir.removeEntry(op.newName) } catch { /* 忽略 */ }
      failed.push(op.oldName)
    }
  }
  if (applied.length) {
    await pushHistory({ time: Date.now(), dir, ops: applied })
  }
  return { ok: failed.length === 0, failed }
}

/** 撤销一次批：恢复旧柄，删除新柄 */
export async function revertBatch(
  dir: FileSystemDirectoryHandle,
  ops: { oldName: string; newName: string }[],
): Promise<string[]> {
  const failed: string[] = []
  for (const op of ops) {
    try {
      const newHandle = await dir.getFileHandle(op.newName)
      const file = await newHandle.getFile()
      const oldHandle: FileSystemFileHandle = await dir.getFileHandle(op.oldName, { create: true })
      const w = await oldHandle.createWritable()
      await w.write(file)
      await w.close()
      await dir.removeEntry(op.newName)
    } catch {
      failed.push(op.newName)
    }
  }
  return failed
}