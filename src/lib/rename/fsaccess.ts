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
  /** 只读模式（<input> 收集）下为 null */
  handle: FileSystemFileHandle | null
}

/** 选夹结果：目录句柄 + 当前层文件 */
export interface DirPickResult {
  dir: FileSystemDirectoryHandle
  files: DirFileEntry[]
}

/** 弹出原生"选文件夹"对话框并收集目录下所有文件（非递归，仅当前层） */
export async function pickDirectory(): Promise<DirPickResult | null> {
  if (!detectFsAccess()) return null
  try {
    const dir: FileSystemDirectoryHandle = await window.showDirectoryPicker()
    const files = await collectDirFiles(dir)
    return { dir, files }
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
    mtime: f.lastModified,
    handle: null,
  }))
}

/**
 * 对目录应用改名：逐个"写目标 -> 删源"。
 * 预览层已阻止"源复用/重叠改名"，此处仅需：目标已存在则跳过（避免覆盖本批之外的文件）。
 * 返回失败的旧名列表；成功部分记入撤销栈。
 */
export async function commitRenames(
  dir: FileSystemDirectoryHandle,
  ops: { oldName: string; newName: string }[],
): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = []
  const applied: { oldName: string; newName: string }[] = []
  for (const op of ops) {
    if (op.oldName === op.newName) continue
    let w: FileSystemWritableFileStream | null = null
    try {
      // 目标已存在：以失败跳过，避免覆盖本批之外的无关联文件
      const exists = await dir.getFileHandle(op.newName).then(() => true, () => false)
      if (exists) { failed.push(op.oldName); continue }
      const oldHandle = await dir.getFileHandle(op.oldName)
      const file = await oldHandle.getFile()
      const newHandle: FileSystemFileHandle = await dir.getFileHandle(op.newName, { create: true })
      w = await newHandle.createWritable()
      await w.write(file)
      await w.close()
      w = null
      await dir.removeEntry(op.oldName)
      applied.push(op)
    } catch {
      try { await w?.abort() } catch { /* 忽略 */ }
      try { await dir.removeEntry(op.newName) } catch { /* 忽略 */ }
      failed.push(op.oldName)
    }
  }
  if (applied.length) {
    try {
      await pushHistory({ time: Date.now(), dir, ops: applied })
    } catch {
      // 已落盘但撤销记录写入失败：不因历史失败把整次判为失败
    }
  }
  return { ok: failed.length === 0, failed }
}

/** 撤销一次批：恢复旧柄，删除新柄；失败时清理可能新建的旧柄残留 */
export async function revertBatch(
  dir: FileSystemDirectoryHandle,
  ops: { oldName: string; newName: string }[],
): Promise<string[]> {
  const failed: string[] = []
  for (const op of ops) {
    let w: FileSystemWritableFileStream | null = null
    try {
      const newHandle = await dir.getFileHandle(op.newName)
      const file = await newHandle.getFile()
      const oldHandle: FileSystemFileHandle = await dir.getFileHandle(op.oldName, { create: true })
      w = await oldHandle.createWritable()
      await w.write(file)
      await w.close()
      w = null
      await dir.removeEntry(op.newName)
    } catch {
      try { await w?.abort() } catch { /* 忽略 */ }
      // 回滚残留：本次用 create:true 尝试建立 oldName 但失败，删除可能留下的空/半写文件
      try { await dir.removeEntry(op.oldName) } catch { /* 忽略 */ }
      failed.push(op.newName)
    }
  }
  return failed
}
