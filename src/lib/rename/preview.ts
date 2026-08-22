// preview.ts：把"文件列表 + 规则"组装成逐行预览结果
import { buildName, type BuildContext } from './build.ts'
import { flagConflicts, uniquify } from './conflict.ts'
import { isRuleActive, type Rule } from './rules.ts'

/** 进入预览的最小文件描述（view 里由 FS 句柄或 <input> File 填充） */
export interface FileEntry2 {
  name: string
  size?: number
  type?: string
  mtime?: number
  /** FS Access 模式下持有文件句柄以写盘；只读模式为 null */
  handle: FileSystemFileHandle | null
}

export interface PreviewRow {
  old: string
  new: string
  changed: boolean
  /** 该行是否被用户跳过（view 层维护 include[]；此处仅初始化为 true） */
  skipped: boolean
  conflict: boolean
  /** 非法原因（空名/非法字符/超长），无则 undefined */
  invalid?: string
}

/** 新名非法校验；返回原因或 undefined */
export function invalidReason(name: string): string | undefined {
  if (!name.trim()) return '空文件名'
  if (/[\\/:*?"<>|]/.test(name)) return '含非法字符'
  if (name.length > 255) return '文件名过长'
  return undefined
}

/** 拆分根名与扩展名：`a.tar.gz` -> ['a.tar', '.gz']；无扩展名 -> [name, ''] */
export function splitName(name: string): [string, string] {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return [name, '']
  return [name.slice(0, idx), name.slice(idx)]
}

/** 取规则中的扩展名规则（应为 0 或 1 个） */
function extRuleOf(rules: Rule[]): Rule | undefined {
  return rules.length ? rules.find((r) => r.type === 'extension') : undefined
}

export interface PreviewOptions {
  /** 是否开启"自动加序号"消解冲突 */
  autoNumber?: boolean
}

export function batchPreview(
  files: FileEntry2[],
  rules: Rule[],
  opts: PreviewOptions = {},
): PreviewRow[] {
  const active = rules.filter(isRuleActive)
  const ext = extRuleOf(active) as { type: 'extension'; mode: 'keep' | 'replace'; ext: string } | undefined
  const nonExt = active.filter((r) => r.type !== 'extension')

  const rawNew = files.map((f, index) => {
    const [stem, oldExt] = splitName(f.name)
    const ctx: BuildContext = { index, mtime: f.mtime }
    const newStem = buildName(stem, nonExt, ctx)
    let newExt = oldExt
    if (ext && ext.mode === 'replace') {
      const e = ext.ext.trim()
      newExt = e ? (e.startsWith('.') ? e : `.${e}`) : ''
    }
    return newStem + newExt
  })

  const rows: PreviewRow[] = files.map((f, i) => {
    const n = rawNew[i]
    return {
      old: f.name,
      new: n,
      changed: n !== f.name,
      skipped: false,
      conflict: false,
      invalid: invalidReason(n),
    }
  })

  // 重名冲突：对所有非 invalid 行检测重名（含未变更行——其原名也会成为碰撞目标），仅标记 changed 行
  const detectNames = rows.map((r, i) => (r.invalid ? `\u0000invalid#${i}` : r.new))
  const conf = flagConflicts(detectNames)
  rows.forEach((r, i) => {
    if (r.changed && conf[i]) r.conflict = true
  })

  if (opts.autoNumber) {
    // 用哨兵将 invalid 行隔离，使其不参与唯一化与冲突重算
    const guarded = rows.map((r, i) => (r.invalid ? `\u0000invalid#${i}` : r.new))
    const uniq = uniquify(guarded)
    uniq.forEach((name, i) => {
      if (rows[i].invalid) return
      rows[i].new = name
      rows[i].changed = name !== rows[i].old
      rows[i].invalid = invalidReason(name)
    })
    const names2 = rows.map((r, i) => (r.invalid ? `\u0000invalid#${i}` : r.new))
    const conf2 = flagConflicts(names2)
    rows.forEach((r, i) => { r.conflict = conf2[i] })
  }

  return rows
}
