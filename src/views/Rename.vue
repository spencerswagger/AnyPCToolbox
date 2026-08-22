<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import RuleBlock from '@/components/rename/RuleBlock.vue'
import { createRule, RULE_TYPES, type Rule, type RuleType } from '@/lib/rename/rules'
import { batchPreview, type FileEntry2 } from '@/lib/rename/preview'
import { diffSegments } from '@/lib/rename/diff'
import { detectFsAccess, pickDirectory, commitRenames, revertBatch, filesToEntries } from '@/lib/rename/fsaccess'
import { popHistory } from '@/lib/rename/history'

const router = useRouter()
const { toast } = useToaster()

const isFsAccess = detectFsAccess()
const dirHandle = ref<FileSystemDirectoryHandle | null>(null)
const files = ref<FileEntry2[]>([])
const rules = ref<Rule[]>([])
const include = ref<boolean[]>([])
const autoNumber = ref(false)
const undoAvailable = ref(false)
const addType = ref<RuleType>('replace')

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

async function handlePick() {
  const res = await pickDirectory()
  if (!res || res.files.length === 0) return
  dirHandle.value = res.dir
  files.value = res.files
  include.value = res.files.map(() => true)
  undoAvailable.value = false
}

function handleFileInput(e: Event) {
  const el = e.target as HTMLInputElement
  if (!el.files) return
  dirHandle.value = null
  files.value = filesToEntries(el.files)
  include.value = files.value.map(() => true)
  undoAvailable.value = false
}

// 拖拽：FS Access 支持时取目录/文件句柄；否则回退 DataTransfer.files
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
      if (dirs.length) { await setFromDir(dirs[0]); return }
      const f2: FileEntry2[] = []
      for (const fh of items) {
        const h = await fh.getAsFileSystemHandle()
        if (!h || h.kind !== 'file') continue
        const file = h as FileSystemFileHandle
        let mtime = Date.now(); let size = 0
        try { const f = await file.getFile(); mtime = f.lastModified; size = f.size } catch { /* 忽略 */ }
        f2.push({ name: file.name, size, type: '', mtime, handle: file })
      }
      dirHandle.value = null
      files.value = f2
      include.value = f2.map(() => true)
      undoAvailable.value = false
    })
    return
  }
  if (dt.files) handleFileInput({ target: { files: dt.files } } as unknown as Event)
}

async function setFromDir(dir: FileSystemDirectoryHandle) {
  dirHandle.value = dir
  const out: FileEntry2[] = []
  for await (const [, hh] of dir.entries()) {
    if (hh.kind !== 'file') continue
    const fh = hh as FileSystemFileHandle
    let mtime = Date.now(); let size = 0; let type = ''
    try { const f = await fh.getFile(); mtime = f.lastModified; size = f.size; type = f.type } catch { /* 忽略 */ }
    out.push({ name: fh.name, size, type, mtime, handle: fh })
  }
  files.value = out
  include.value = out.map(() => true)
  undoAvailable.value = false
}

function removeFile(i: number) {
  files.value.splice(i, 1)
  include.value.splice(i, 1)
}

function addRule() { rules.value.push(createRule(addType.value)) }
function updateRule(i: number, r: Rule) { rules.value[i] = r }
function removeRule(i: number) { rules.value.splice(i, 1) }
function moveRule(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= rules.value.length) return
  const arr = [...rules.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  rules.value = arr
}

async function applyChanges() {
  if (!isFsAccess || !dirHandle.value) { exportList(); return }
  const targets = rows.value
    .filter((r, i) => include.value[i] && r.changed && !r.invalid)
    .map((r) => ({ oldName: r.old, newName: r.new }))
  if (!targets.length) return
  const res = await commitRenames(dirHandle.value, targets)
  const failedSet = new Set(res.failed)
  if (res.failed.length) {
    // 部分成功：同步成功项到本地，并允许撤销已写入历史的成功子集
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
  toast(undefined, `已改名 ${targets.length} 个文件`)
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
  const failed = await revertBatch(batch.dir, batch.ops)
  // 本地列表与磁盘同步回原名
  batch.ops.forEach((op) => {
    const idx = files.value.findIndex((f) => f.name === op.newName)
    if (idx >= 0) files.value[idx] = { ...files.value[idx], name: op.oldName }
  })
  undoAvailable.value = false
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
      <div class="ml-auto flex items-center gap-2">
        <button v-if="isFsAccess" type="button" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground" @click="handlePick">📁 选文件夹</button>
        <button type="button" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40" :disabled="!undoAvailable" @click="undo">撤销</button>
      </div>
    </div>

    <!-- 能力边界提示 -->
    <div v-if="!isFsAccess" class="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">⚠️ 当前环境无法直接修改磁盘文件，仅支持预览与导出改名列表（建议使用 Chrome/Edge 或桌面版）。</div>

    <!-- 文件区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">📂 文件区</div>
      <div class="flex flex-col items-center gap-1 border-b border-dashed px-4 py-6 text-sm text-muted-foreground" @dragover.prevent @drop="onDrop">
        <span>拖拽文件夹/文件到此处</span>
        <label class="mt-1 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">或选择文件
          <input type="file" multiple class="hidden" @change="handleFileInput">
        </label>
      </div>
      <ul v-if="files.length" class="max-h-56 overflow-auto divide-y divide-border">
        <li v-for="(f, i) in files" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
          <span class="truncate">{{ f.name }}</span>
          <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{ f.size != null ? (f.size / 1024).toFixed(1) + ' KB' : '' }}<span class="mx-0.5">·</span>{{ f.type || '文件' }}</span>
          <button type="button" title="移除" aria-label="移除" class="shrink-0 rounded border border-input px-1.5 text-xs hover:bg-destructive/10 hover:text-destructive" @click="removeFile(i)">✕</button>
        </li>
      </ul>
    </div>

    <!-- 规则区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>🧰 规则（从上到下依次作用）</span>
        <div class="ml-auto flex items-center gap-2">
          <select v-model="addType" class="rounded-md border border-input bg-background px-2 py-1 text-xs">
            <option v-for="t in RULE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <button type="button" class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="addRule">+ 添加规则</button>
        </div>
      </div>
      <div v-if="rules.length" class="space-y-3 p-3">
        <RuleBlock v-for="(r, i) in rules" :key="i" :rule="r" :can-up="i > 0" :can-down="i < rules.length - 1" @update:rule="updateRule(i, $event)" @remove="removeRule(i)" @move="moveRule(i, $event)" />
      </div>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">点击右上角"添加规则"开始配置</div>
    </div>

    <!-- 预览区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>👁️ 预览（勾选应用，增绿删红）</span>
        <label class="ml-auto flex items-center gap-1 text-xs text-muted-foreground normal-case"><input v-model="autoNumber" type="checkbox"> 冲突自动加序号</label>
      </div>
      <ul v-if="rows.length" class="max-h-72 overflow-auto divide-y divide-border">
        <li v-for="(r, i) in rows" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
          <input v-model="include[i]" type="checkbox" class="shrink-0">
          <div class="min-w-0 flex-1 truncate font-mono text-xs">
            <span class="text-muted-foreground line-through">{{ r.old }}</span>
            <span class="mx-1 text-muted-foreground">→</span>
            <template v-if="r.new === r.old"><span class="text-muted-foreground">{{ r.old }}</span></template>
            <template v-else-if="r.invalid"><span class="text-destructive">{{ r.new }}</span></template>
            <template v-else>
              <span v-for="(sg, k) in diffSegments(r.old, r.new)" :key="k" :class="{ 'text-emerald-600 dark:text-emerald-400': sg.type === 'add', 'text-destructive': sg.type === 'del' }">{{ sg.text }}</span>
            </template>
          </div>
          <span v-if="r.conflict" class="shrink-0 text-xs text-destructive">⛔ 重名</span>
          <span v-if="r.invalid" class="shrink-0 text-xs text-destructive" :title="r.invalid">{{ r.invalid }}</span>
        </li>
      </ul>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">请先选择文件</div>
    </div>

    <!-- 底栏 -->
    <div class="flex items-center gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>共 {{ stats.total }} · 将改 {{ stats.willChange }}{{ stats.invalid ? ' · 非法 ' + stats.invalid : '' }} · 冲突 {{ stats.conflict }}</span>
      <button v-if="isFsAccess" type="button" class="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" :disabled="!stats.willChange || stats.conflict > 0 || stats.invalid > 0" @click="applyChanges">应用更改</button>
      <button v-else type="button" class="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40" :disabled="!stats.willChange" @click="exportList">导出改名列表</button>
    </div>
  </div>
</template>
