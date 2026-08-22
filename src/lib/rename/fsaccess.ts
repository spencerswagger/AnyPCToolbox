// fsaccess.ts：File System Access API 的薄封装。
// 能力检测 -> 选夹 -> 递归遍历文件 -> 写盘改名 -> 回滚撤销。
import { pushHistory, type RenameOp } from './history'

/** 环境是否支持 FS Access API（决定真写盘还是只读导出） */
export function detectFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export interface DirFileEntry {
  /** 文件名（不含路径） */
  name: string
  /** 相对根目录的完整路径，含子目录（如 sub/img.jpg）；顶层文件即文件名 */
  rel: string
  size: number
  type: string
  mtime: number
  /** 只读模式（<input> 收集）下为 null */
  handle: FileSystemFileHandle | null
}

/** 选夹结果：根目录句柄 + 其下递归文件 */
export interface DirPickResult {
  root: FileSystemDirectoryHandle
  files: DirFileEntry[]
}

/** 弹出原生"选文件夹"对话框并递归收集目录下所有文件 */
export async function pickDirectory(): Promise<DirPickResult | null> {
  if (!detectFsAccess()) return null
  try {
    const root: FileSystemDirectoryHandle = await window.showDirectoryPicker()
    const files = await collectDirFiles(root, '')
    return { root, files }
  } catch {
    return null // 用户取消或出错
  }
}

async function collectDirFiles(dir: FileSystemDirectoryHandle, rel: string): Promise<DirFileEntry[]> {
  const out: DirFileEntry[] = []
  for await (const [name, handle] of dir.entries()) {
    const relPath = rel ? `${rel}/${name}` : name
    if (handle.kind === 'directory') {
      out.push(...(await collectDirFiles(handle, relPath)))
    } else if (handle.kind === 'file') {
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
      out.push({ name: fh.name, rel: relPath, size, type, mtime, handle: fh })
    }
  }
  return out
}

/** 未支持 FS API 时从 <input type=file multiple> 收集（只读模式，无路径） */
export function filesToEntries(files: FileList): DirFileEntry[] {
  return Array.from(files).map((f) => ({
    name: f.name,
    rel: f.name,
    size: f.size,
    type: f.type,
    mtime: f.lastModified,
    handle: null,
  }))
}

/** 解析 rel 路径：返回最末文件名所在的父目录句柄与文件名 */
async function resolveParent(root: FileSystemDirectoryHandle, rel: string): Promise<{ dir: FileSystemDirectoryHandle; base: string }> {
  const segs = rel.split('/')
  const base = segs.pop()!
  let dir = root
  for (const seg of segs) {
    dir = await dir.getDirectoryHandle(seg, { create: true })
  }
  return { dir, base }
}

/**
 * 对文件应用改名：逐个"写目标 -> 删源"，old/new 为相对各自根目录 root 的相对路径（可含子目录）。
 * 预览层已阻止"源复用/重叠改名"，此处仅需：目标已存在则跳过（避免覆盖本批之外的文件）。
 * 返回失败的旧名列表；成功部分记入撤销栈。
 */
export async function commitRenames(ops: RenameOp[]): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = []
  const applied: RenameOp[] = []
  for (const op of ops) {
    if (op.oldName === op.newName) continue
    let w: FileSystemWritableFileStream | null = null
    try {
      const src = await resolveParent(op.dir, op.oldName)
      const file = await (await src.dir.getFileHandle(src.base)).getFile()
      const dst = await resolveParent(op.dir, op.newName)
      // 目标已存在：以失败跳过，避免覆盖本批之外的无关联文件
      const exists = await dst.dir.getFileHandle(dst.base).then(() => true, () => false)
      if (exists) { failed.push(op.oldName); continue }
      const newHandle: FileSystemFileHandle = await dst.dir.getFileHandle(dst.base, { create: true })
      w = await newHandle.createWritable()
      await w.write(file)
      await w.close()
      w = null
      await src.dir.removeEntry(src.base)
      applied.push(op)
    } catch {
      try { await w?.abort() } catch { /* 忽略 */ }
      failed.push(op.oldName)
    }
  }
  if (applied.length) {
    try {
      await pushHistory({ time: Date.now(), ops: applied })
    } catch {
      // 已落盘但撤销记录写入失败：不因历史失败把整次判为失败
    }
  }
  return { ok: failed.length === 0, failed }
}

/** 撤销一次批：恢复旧名，删除新名；失败时清理可能新建的旧名残留 */
export async function revertBatch(ops: RenameOp[]): Promise<string[]> {
  const failed: string[] = []
  for (const op of ops) {
    let w: FileSystemWritableFileStream | null = null
    try {
      const src = await resolveParent(op.dir, op.newName)
      const file = await (await src.dir.getFileHandle(src.base)).getFile()
      const dst = await resolveParent(op.dir, op.oldName)
      const oldHandle: FileSystemFileHandle = await dst.dir.getFileHandle(dst.base, { create: true })
      w = await oldHandle.createWritable()
      await w.write(file)
      await w.close()
      w = null
      await src.dir.removeEntry(src.base)
    } catch {
      try { await w?.abort() } catch { /* 忽略 */ }
      // 回滚残留：本次用 create:true 尝试建立旧名但失败，删除可能留下的空/半写文件
      try {
        const dst = await resolveParent(op.dir, op.oldName)
        await dst.dir.removeEntry(dst.base)
      } catch { /* 忽略 */ }
      failed.push(op.newName)
    }
  }
  return failed
}