<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import RuleBlock from '@/components/rename/RuleBlock.vue'
import { createRule, type Rule } from '@/lib/rename/rules'
import { batchPreview, type FileEntry2 } from '@/lib/rename/preview'
import { detectFsAccess, pickDirectory, commitRenames, revertBatch, filesToEntries } from '@/lib/rename/fsaccess'
import { popHistory } from '@/lib/rename/history'

const router = useRouter()
const { toast } = useToaster()

const isFsAccess = detectFsAccess()

// 文件模型：files[name] 为相对路径（含子目录），root 为写盘用根目录句柄（仅文件夹选取时有值）
const files = ref<FileEntry2[]>([])
const rules = ref<Rule[]>([createRule('replace')])
const include = ref<boolean[]>([])
const autoNumber = ref(false)
const undoAvailable = ref(false)
const applied = ref(false)
const folderRef = ref<HTMLInputElement | null>(null)
const openKeys = ref<Set<string>>(new Set())

const rows = computed(() => batchPreview(files.value, rules.value, { autoNumber: autoNumber.value }))

const stats = computed(() => {
  const vis = rows.value.filter((_, i) => include.value[i])
  return {
    total: files.value.length,
    willChange: vis.filter((r) => r.changed && !r.invalid).length,
    conflict: vis.filter((r) => r.conflict).length,
    invalid: vis.filter((r) => !!r.invalid).length,
  }
})

const hasWritable = computed(() => files.value.some((f) => !!f.root))

/* ---------------- 树状视图 ----------------
 * 根据相对路径把文件组织成目录树（目录可折叠），叶子关联文件下标。 */
interface TNode {
  key: string
  depth: number
  kind: 'dir' | 'file'
  label: string
  path: string
  index?: number
}

function buildTree(list: FileEntry2[]): TNode[] {
  const dirChildren = new Map<string, Set<string>>()
  const fileIndexes = new Map<string, number[]>()
  const ensureDir = (p: string) => { if (!dirChildren.has(p)) dirChildren.set(p, new Set()) }
  ensureDir('')
  list.forEach((f, idx) => {
    const segs = f.name.split('/')
    const parent = segs.slice(0, -1).join('/')
    if (!fileIndexes.has(parent)) fileIndexes.set(parent, [])
    fileIndexes.get(parent)!.push(idx)
    let cur = ''
    for (const seg of segs.slice(0, -1)) {
      ensureDir(cur)
      dirChildren.get(cur)!.add(seg)
      cur = cur ? `${cur}/${seg}` : seg
    }
  })
  const nodes: TNode[] = []
  const walk = (parent: string, depth: number) => {
    for (const d of [...(dirChildren.get(parent) ?? [])].sort()) {
      const p = parent ? `${parent}/${d}` : d
      nodes.push({ key: 'dir:' + p, depth, kind: 'dir', label: d, path: p })
      walk(p, depth + 1)
    }
    for (const idx of fileIndexes.get(parent) ?? []) {
      const f = list[idx]
      nodes.push({ key: 'file:' + idx, depth, kind: 'file', label: f.name.split('/').pop()!, path: f.name, index: idx })
    }
  }
  walk('', 0)
  return nodes
}

const tree = computed(() => buildTree(files.value))

const visibleTree = computed(() => {
  const out: TNode[] = []
  let hideDepth = -1
  for (const n of tree.value) {
    if (hideDepth >= 0 && n.depth > hideDepth) continue
    if (hideDepth >= 0 && n.depth <= hideDepth) hideDepth = -1
    out.push(n)
    if (n.kind === 'dir' && !openKeys.value.has(n.key)) hideDepth = n.depth
  }
  return out
})

function openAllDirs() {
  openKeys.value = new Set(tree.value.filter((n) => n.kind === 'dir').map((n) => n.key))
}
function toggleDir(key: string) {
  const next = new Set(openKeys.value)
  next.has(key) ? next.delete(key) : next.add(key)
  openKeys.value = next
}
function toggleFile(idx: number) {
  include.value[idx] = !include.value[idx]
}
function removeFile(idx: number) {
  files.value.splice(idx, 1)
  include.value.splice(idx, 1)
}

/* ---------------- 文件载入（追加而非覆盖，去重） ---------------- */
function addEntries(newEntries: FileEntry2[]) {
  if (!newEntries.length) return
  const seen = new Set(files.value.map((f) => f.name))
  const toAdd = newEntries.filter((e) => !seen.has(e.name))
  if (!toAdd.length) return
  files.value = [...files.value, ...toAdd]
  include.value = files.value.map(() => true)
  undoAvailable.value = false
  applied.value = false
  openAllDirs()
}

function fileEntryToModel(e: { rel: string; size?: number; type?: string; mtime?: number; root?: FileSystemDirectoryHandle | null }): FileEntry2 {
  return { name: e.rel, size: e.size, type: e.type, mtime: e.mtime, handle: null, root: e.root ?? null }
}

/** 文件区"选择文件夹"：FS Access 可用时走 showDirectoryPicker（递归+可写盘），否则回退 webkitdirectory 只读 */
async function chooseFolder() {
  if (isFsAccess) {
    const res = await pickDirectory()
    if (!res || !res.files.length) return
    addEntries(res.files.map((e) => ({ name: e.rel, size: e.size, type: e.type, mtime: e.mtime, handle: e.handle, root: res.root })))
    return
  }
  folderRef.value?.click()
}

/** webkitdirectory 只读兜底：递归收集（File.webkitRelativePath 已含子目录） */
function handleFolderInput(e: Event) {
  const el = e.target as HTMLInputElement
  el.value = ''
  if (!el.files) return
  addEntries(
    Array.from(el.files).map((f) => ({
      name: (f as File).webkitRelativePath || f.name,
      size: f.size,
      type: f.type,
      mtime: f.lastModified || Date.now(),
      handle: null,
      root: null,
    })),
  )
}

function handleFileInput(e: Event) {
  const el = e.target as HTMLInputElement
  if (!el.files) return
  addEntries(filesToEntries(el.files).map(fileEntryToModel))
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const dt = e.dataTransfer
  if (!dt) return
  if (isFsAccess && [...dt.items].some((it) => it.kind === 'file')) {
    const items = [...dt.items].filter((it) => it.kind === 'file')
    const dirs: FileSystemDirectoryHandle[] = []
    Promise.all(
      items.map((it) =>
        it.getAsFileSystemHandle().then((h) => {
          if (h?.kind === 'directory') dirs.push(h as FileSystemDirectoryHandle)
        }),
      ),
    ).then(async () => {
      if (dirs.length) {
        // 拖入目录：递归收集并带上根句柄（可写盘）
        const entries = await collectFromHandle(dirs[0], '')
        addEntries(entries.map((e) => ({ name: e.rel, size: e.size, type: e.type, mtime: e.mtime, handle: e.handle, root: dirs[0] })))
        return
      }
      const f2: FileEntry2[] = []
      for (const fh of items) {
        const h = await fh.getAsFileSystemHandle()
        if (!h || h.kind !== 'file') continue
        const file = h as FileSystemFileHandle
        let mtime = Date.now(); let size = 0
        try { const f = await file.getFile(); mtime = f.lastModified; size = f.size } catch { /* 忽略 */ }
        f2.push({ name: file.name, size, type: '', mtime, handle: file, root: null })
      }
      addEntries(f2)
    })
    return
  }
  if (dt.files) handleFileInput({ target: { files: dt.files } } as unknown as Event)
}

async function collectFromHandle(dir: FileSystemDirectoryHandle, rel: string): Promise<{ rel: string; size: number; type: string; mtime: number; handle: FileSystemFileHandle }[]> {
  const out: { rel: string; size: number; type: string; mtime: number; handle: FileSystemFileHandle }[] = []
  for await (const [name, hh] of dir.entries()) {
    const relPath = rel ? `${rel}/${name}` : name
    if (hh.kind === 'directory') out.push(...(await collectFromHandle(hh as FileSystemDirectoryHandle, relPath)))
    else if (hh.kind === 'file') {
      const fh = hh as FileSystemFileHandle
      let size = 0; let type = ''; let mtime = 0
      try { const f = await fh.getFile(); size = f.size; type = f.type; mtime = f.lastModified } catch { /* 忽略 */ }
      out.push({ rel: relPath, size, type, mtime, handle: fh })
    }
  }
  return out
}

/* ---------------- 规则 CRUD ---------------- */
function addRule() { rules.value.push(createRule('replace')); applied.value = false }
function updateRule(i: number, r: Rule) { rules.value[i] = r; applied.value = false }
function removeRule(i: number) { rules.value.splice(i, 1); applied.value = false }
function moveRule(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= rules.value.length) return
  const arr = [...rules.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  rules.value = arr
  applied.value = false
}

/* ---------------- 应用 / 导出 / 撤销 ---------------- */
async function applyChanges() {
  if (!isFsAccess) { exportList(); return }
  const ops = rows.value.flatMap((r, i) => {
    if (!include.value[i] || !r.changed || r.invalid) return []
    const file = files.value[i]
    if (!file.root) return []
    return [{ dir: file.root, oldName: r.old, newName: r.new }]
  })
  if (!ops.length) { toast(undefined, '没有可写盘的文件（请通过"选择文件夹"载入）'); return }
  const res = await commitRenames(ops)
  const failedSet = new Set(res.failed)
  if (res.failed.length) {
    rows.value.forEach((r, i) => {
      if (include.value[i] && r.changed && !r.invalid && !failedSet.has(r.old)) {
        files.value[i] = { ...files.value[i], name: r.new }
      }
    })
    undoAvailable.value = true
    toast(undefined, `部分失败：${res.failed.join(', ')}`)
    return
  }
  undoAvailable.value = true
  rows.value.forEach((r, i) => {
    if (include.value[i] && r.changed && !r.invalid) files.value[i] = { ...files.value[i], name: r.new }
  })
  include.value = include.value.map(() => true)
  applied.value = true
  toast(undefined, `已改名 ${ops.length} 个文件`)
}

function exportList() {
  const lines = rows.value
    .filter((r, i) => include.value[i] && r.changed)
    .map((r) => `${r.old}\t${r.new}`)
  if (!lines.length) return
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rename-plan.txt'
  a.click()
  URL.revokeObjectURL(url)
  toast(undefined, `已导出 ${lines.length} 条改名计划`)
}

async function undo() {
  const batch = await popHistory()
  if (!batch) { toast(undefined, '无撤销记录'); return }
  const failed = await revertBatch(batch.ops)
  batch.ops.forEach((op) => {
    const idx = files.value.findIndex((f) => f.name === op.newName)
    if (idx >= 0) files.value[idx] = { ...files.value[idx], name: op.oldName }
  })
  undoAvailable.value = false
  applied.value = false
  toast(undefined, failed.length ? `撤销部分失败：${failed.join(', ')}` : '已撤销')
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button type="button" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" @click="router.push('/')">← 返回</button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">文件批量重命名</h2>
    </div>

    <!-- 能力边界提示 -->
    <div v-if="!isFsAccess" class="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">⚠️ 当前环境无法直接修改磁盘文件，仅支持预览与导出改名列表（建议使用 Chrome/Edge 或桌面版）。</div>

    <!-- 文件区（树状） -->
    <div class="flex flex-col rounded-lg border">
      <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">📂 文件区（{{ files.length }}）</div>
      <div class="flex flex-col items-center gap-1 border-b border-dashed px-4 py-6 text-sm text-muted-foreground" @dragover.prevent @drop="onDrop">
        <span>拖拽文件夹/文件到此处（追加）</span>
        <div class="mt-1 flex items-center gap-2">
          <button type="button" class="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground" @click="chooseFolder">选择文件夹</button>
          <label class="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">选择文件
            <input type="file" multiple class="sr-only" @change="handleFileInput">
          </label>
          <input ref="folderRef" type="file" webkitdirectory class="hidden" @change="handleFolderInput">
        </div>
      </div>
      <ul v-if="visibleTree.length" class="max-h-64 overflow-auto divide-y divide-border">
        <li v-for="n in visibleTree" :key="n.key" class="flex items-center gap-1 text-sm" :style="{ paddingLeft: n.depth * 14 + 8 + 'px' }">
          <template v-if="n.kind === 'dir'">
            <button type="button" class="flex w-full items-center gap-1 py-1 text-left font-medium text-muted-foreground hover:text-foreground" @click="toggleDir(n.key)">
              <span class="inline-block w-3 text-xs">{{ openKeys.has(n.key) ? '▾' : '▸' }}</span>
              <span>📁 {{ n.label }}</span>
            </button>
          </template>
          <template v-else>
            <button type="button" class="flex w-full items-center gap-1 py-1 text-left hover:bg-accent/40" @click="toggleFile(n.index!)">
              <input :checked="include[n.index!]" type="checkbox" class="pointer-events-none shrink-0">
              <span class="truncate">{{ n.label }}</span>
              <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{ (files[n.index!].size ?? 0) / 1024 > 0 ? ((files[n.index!].size ?? 0) / 1024).toFixed(1) + ' KB' : '' }}</span>
              <span class="shrink-0 rounded border border-input px-1 text-xs hover:bg-destructive/10 hover:text-destructive" @click.stop="removeFile(n.index!)">✕</span>
            </button>
          </template>
        </li>
      </ul>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">尚未载入文件</div>
    </div>

    <!-- 规则区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>🧰 规则（从上到下依次作用）</span>
        <div class="ml-auto flex items-center gap-2">
          <button type="button" class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="addRule">+ 添加规则</button>
        </div>
      </div>
      <div v-if="rules.length" class="space-y-2 p-3">
        <RuleBlock v-for="(r, i) in rules" :key="i" :rule="r" :can-up="i > 0" :can-down="i < rules.length - 1" @update:rule="updateRule(i, $event)" @remove="removeRule(i)" @move="moveRule(i, $event)" />
      </div>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">点击右上角"添加规则"开始配置</div>
    </div>

    <!-- 预览区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>👁️ 预览（绿色=将改名，灰色=不变，整行可点击勾选）</span>
        <label class="ml-auto flex items-center gap-1 text-xs text-muted-foreground normal-case"><input v-model="autoNumber" type="checkbox"> 冲突自动加序号</label>
      </div>
      <ul v-if="rows.length" class="max-h-72 overflow-auto divide-y divide-border">
        <li v-for="(r, i) in rows" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/40" :class="{ 'cursor-pointer': true }" @click="toggleFile(i)">
          <input :checked="include[i]" type="checkbox" class="pointer-events-none shrink-0">
          <div class="min-w-0 flex-1 truncate font-mono text-xs">
            <template v-if="r.invalid"><span class="text-destructive">{{ r.new }}</span></template>
            <template v-else-if="r.changed">
              <span class="text-emerald-600 dark:text-emerald-400">{{ r.new }}</span>
              <span class="ml-1 text-muted-foreground">← {{ r.old }}</span>
            </template>
            <template v-else><span class="text-muted-foreground">{{ r.old }}</span></template>
          </div>
          <span v-if="r.conflict" class="shrink-0 text-xs text-destructive">⛔ 重名</span>
          <span v-if="r.invalid" class="shrink-0 text-xs text-destructive" :title="r.invalid">{{ r.invalid }}</span>
        </li>
      </ul>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">请先载入文件</div>
    </div>

    <!-- 底栏 -->
    <div class="flex items-center gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>共 {{ stats.total }} · 将改 {{ stats.willChange }}{{ stats.invalid ? ' · 非法 ' + stats.invalid : '' }} · 冲突 {{ stats.conflict }}</span>
      <div class="ml-auto flex items-center gap-3">
        <span v-if="isFsAccess && !hasWritable" class="text-xs text-muted-foreground">未选文件夹，无法应用</span>
        <span v-if="applied" class="text-xs text-emerald-600 dark:text-emerald-400">已应用，可撤销或调整</span>
        <button v-if="isFsAccess" type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" :disabled="applied || !hasWritable || !stats.willChange || stats.conflict > 0 || stats.invalid > 0" @click="applyChanges">应用更改</button>
        <button v-else type="button" class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" :disabled="!stats.willChange" @click="exportList">导出改名列表</button>
        <button type="button" class="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40" :disabled="!undoAvailable" @click="undo">撤销</button>
      </div>
    </div>
  </div>
</template>