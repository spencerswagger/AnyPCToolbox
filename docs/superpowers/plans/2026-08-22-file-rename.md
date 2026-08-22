# 文件批量重命名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具箱新增纯前端"文件批量重命名"工具：可视化规则块 + 实时预览 + 真实写盘（File System Access API）+ IndexedDB 撤销。

**Architecture:** 核心为可测纯函数 `buildName`（改名逻辑与 UI 完全解耦），配合 `preview/conflict/diff` 等纯函数做预览与冲突处理；浏览器 API（FS Access / IndexedDB）封装在 `fsaccess.ts` / `history.ts`，页面视图 `Rename.vue` 组装。环境不支持 FS Access 时降级为只读预览 + 导出改名列表。

**Tech Stack:** Vue 3 + TypeScript + TailwindCss + lucide-vue-next + vue-router（路由 `/rename`）。无测试框架，沿用 `scripts/verify-*.ts` 自检脚本约定（`node scripts/verify-rename-*.ts`）。无新增依赖。

**测试约定：** 本仓库无 vitest，纯函数验证用 `doc` 脚本：`node scripts/verify-<模块>.ts`（依赖 Node 的 TS 类型剥离支持，与 `scripts/verify-idcard.ts` 一致）。

---

## 文件结构

- Create: `src/lib/rename/rules.ts` — 7 种规则的 TS 类型、标签、默认工厂
- Create: `src/lib/rename/build.ts` — `buildName()` 纯函数 + `formatStamp()`
- Create: `src/lib/rename/diff.ts` — 差异高亮 diff
- Create: `src/lib/rename/conflict.ts` — 冲突检测 + 自动补序号
- Create: `src/lib/rename/preview.ts` — `batchPreview()` 组装预览行
- Create: `src/lib/rename/history.ts` — IndexedDB 撤销栈
- Create: `src/lib/rename/fsaccess.ts` — FS Access API 封装（选夹/遍历/写盘/撤销）+ `detectFsAccess()`
- Create: `src/components/rename/RuleBlock.vue` — 规则块参数表单
- Create: `src/views/Rename.vue` — 页面
- Modify: `src/router/index.ts` — 注册 `/rename`
- Modify: `src/views/Home.vue` — 增加工具卡片
- Create: `scripts/verify-rename-build.ts` / `verify-rename-diff.ts` / `verify-rename-conflict.ts` / `verify-rename-preview.ts` — 纯函数自检

---

### Task 1: 规则类型与默认工厂（rules.ts）

**Files:**
- Create: `src/lib/rename/rules.ts`
- Test: `scripts/verify-rename-build.ts`（在本任务只做最小类型校验，具体行为在 Task 2）

- [ ] **Step 1: 编写 rules.ts**

```ts
export type RuleType =
  | 'replace'
  | 'prefix'
  | 'suffix'
  | 'sequence'
  | 'timestamp'
  | 'case'
  | 'remove'
  | 'extension'

export interface ReplaceRule { type: 'replace'; find: string; with: string; onlyFirst: boolean; regex: boolean }
export interface AffixRule { type: 'prefix' | 'suffix'; text: string }
export interface SequenceRule { type: 'sequence'; start: number; step: number; width: number; position: 'front' | 'back'; sep: string }
export interface TimestampRule { type: 'timestamp'; format: string; source: 'now' | 'mtime'; position: 'front' | 'back'; sep: string }
export interface CaseRule { type: 'case'; mode: 'upper' | 'lower' | 'cap' }
export interface RemoveRule { type: 'remove'; mode: 'range' | 'chars'; start: number; count: number; chars: string }
export interface ExtensionRule { type: 'extension'; mode: 'keep' | 'replace'; ext: string }

export type Rule =
  | ReplaceRule
  | AffixRule
  | SequenceRule
  | TimestampRule
  | CaseRule
  | RemoveRule
  | ExtensionRule

/** 规则类型下拉选项（顺序即展示顺序） */
export const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'replace', label: '查找-替换' },
  { value: 'prefix', label: '前缀' },
  { value: 'suffix', label: '后缀' },
  { value: 'sequence', label: '序号' },
  { value: 'timestamp', label: '时间戳' },
  { value: 'case', label: '大小写' },
  { value: 'remove', label: '删除字符' },
  { value: 'extension', label: '扩展名' },
]

export const RULE_LABEL: Record<RuleType, string> = Object.fromEntries(
  RULE_TYPES.map((r) => [r.value, r.label]),
) as Record<RuleType, string>

export const TIMESTAMP_FORMATS = ['YYYYMMDD', 'YYYY-MM-DD', 'YYYYMMDD_HHmmss', 'YYYY-MM-DD_HHmmss']

/** 时间戳格式(token) 最小实现：YYYY/YY/MM/DD/HH/mm/ss */
export function formatStamp(ms: number, format: string): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const map: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    YY: String(d.getFullYear()).slice(-2),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  }
  return format.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (t) => map[t] ?? t)
}

/** 创建某类型的默认规则实例 */
export function createRule(type: RuleType): Rule {
  switch (type) {
    case 'replace':
      return { type, find: '', with: '', onlyFirst: false, regex: false }
    case 'prefix':
      return { type, text: '' }
    case 'suffix':
      return { type, text: '' }
    case 'sequence':
      return { type, start: 1, step: 1, width: 2, position: 'front', sep: '_' }
    case 'timestamp':
      return { type, format: 'YYYYMMDD', source: 'mtime', position: 'front', sep: '_' }
    case 'case':
      return { type, mode: 'upper' }
    case 'remove':
      return { type, mode: 'range', start: 1, count: 1, chars: '' }
    case 'extension':
      return { type, mode: 'keep', ext: '' }
  }
}

/** 规则默认值是否「未配置」：用于校验哪些规则会被跳过 */
export function isRuleActive(r: Rule): boolean {
  switch (r.type) {
    case 'replace':
      return r.find.length > 0
    case 'prefix':
    case 'suffix':
      return r.text.length > 0
    case 'sequence':
    case 'timestamp':
    case 'case':
      return true
    case 'remove':
      return r.mode === 'range' ? r.count > 0 : r.chars.length > 0
    case 'extension':
      return r.mode === 'replace' ? r.ext.length > 0 : false
  }
}
```

- [ ] **Step 2: 确认类型能编译**

Run: `npx vue-tsc --noEmit`
Expected: 无报错（此时仅新建 rules.ts，尚未被引用）。

- [ ] **Step 3: 提交**

```bash
git add src/lib/rename/rules.ts
git commit -m "feat(rename): add rule types and factory"
```

---

### Task 2: 核心纯函数 buildName（build.ts）

**Files:**
- Create: `src/lib/rename/build.ts`
- Create: `scripts/verify-rename-build.ts`

- [ ] **Step 1: 编写失败的自检脚本**

`scripts/verify-rename-build.ts`：

```ts
// build.ts 逻辑自检脚本（约定同 scripts/verify-idcard.ts）
// 运行：node scripts/verify-rename-build.ts
import { buildName, formatStamp, type BuildContext } from '../src/lib/rename/build.ts'
import type { Rule } from '../src/lib/rename/rules.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
const ctx: BuildContext = { index: 0, mtime: new Date('2026-08-22T10:30:00').getTime() }
const r = (rules: Rule[]): string => buildName('IMG_001', rules, ctx)

console.log('查找-替换')
check('替换命中', r([{ type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false }]) === 'Photo_001')
check('替换未命中保持原名', r([{ type: 'replace', find: 'XYZ', with: 'A', onlyFirst: false, regex: false }]) === 'IMG_001')
check('仅首个', r([{ type: 'replace', find: '0', with: 'X', onlyFirst: true, regex: false }]) === 'IMG_X01')
check('全部替换', r([{ type: 'replace', find: '0', with: 'X', onlyFirst: false, regex: false }]) === 'IMG_XX1')

console.log('前缀/后缀')
check('前缀', r([{ type: 'prefix', text: '2025-' }]) === '2025-IMG_001')
check('后缀', r([{ type: 'suffix', text: '_final' }]) === 'IMG_001_final')

console.log('序号')
check('前置补零', r([{ type: 'sequence', start: 1, step: 1, width: 2, position: 'front', sep: '_' }]) === '01_IMG_001')
check('后置', r([{ type: 'sequence', start: 10, step: 2, width: 2, position: 'back', sep: '-' }]) === 'IMG_001-10')
const ctx2: BuildContext = { index: 2, mtime: ctx.mtime }
check('按 index 递增', buildName('a', [{ type: 'sequence', start: 1, step: 1, width: 2, position: 'back', sep: '_' }], ctx2) === 'a_03')

console.log('时间戳')
check('mtime 前位置', r([{ type: 'timestamp', format: 'YYYYMMDD', source: 'mtime', position: 'front', sep: '_' }]) === '20260822_IMG_001')
check('now 后位置', r([{ type: 'timestamp', format: 'YYYY-MM-DD', source: 'now', position: 'back', sep: '_' }]).endsWith('_2026-08-22'))

console.log('大小写')
check('全大写', r([{ type: 'case', mode: 'upper' }]) === 'IMG_001')
check('全小写', r([{ type: 'case', mode: 'lower' }]) === 'img_001')
check('首字母大写', r([{ type: 'case', mode: 'cap' }]) === 'Img_001')

console.log('删除字符')
check('删前4位', r([{ type: 'remove', mode: 'range', start: 1, count: 4, chars: '' }]) === '_001')
check('删指定字符集', r([{ type: 'remove', mode: 'chars', start: 1, count: 1, chars: 'I' }]) === 'MG_001')

console.log('规则顺序生效')
check('先替换再前缀', r([
  { type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false },
  { type: 'prefix', text: 'id-' },
]) === 'id-Photo_001')

console.log('formatStamp')
check('YYYYMMDD', formatStamp(ctx.mtime, 'YYYYMMDD') === '20260822')
check('YYYY-MM-DD_HHmmss', formatStamp(ctx.mtime, 'YYYY-MM-DD_HHmmss') === '2026-08-22_103000')

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-rename-build.ts`
Expected: 报错（找不到 `build.ts` 或未导出函数）。

- [ ] **Step 3: 实现 build.ts**

```ts
// build.ts：单个文件"根名" -> 新"根名"的纯函数（不含扩展名规则）
// 规则按数组顺序依次作用。扩展名在 preview.ts 层处理，不进入本函数。
import { formatStamp, type Rule, type ReplaceRule } from './rules'

export interface BuildContext {
  /** 该文件在其预览队列中的序号（0 起） */
  index: number
  /** 文件修改时间(ms)；无则 undefined（时间戳 source='mtime' 时回退当前时间） */
  mtime?: number
}

export function buildName(stem: string, rules: Rule[], ctx: BuildContext): string {
  let name = stem
  for (const rule of rules) {
    if (rule.type === 'extension') continue // 扩展名在 preview 层处理
    name = applyRule(name, rule, ctx)
  }
  return name
}

function applyRule(name: string, rule: Rule, ctx: BuildContext): string {
  switch (rule.type) {
    case 'replace':
      return applyReplace(name, rule)
    case 'prefix':
      return rule.text + name
    case 'suffix':
      return name + rule.text
    case 'sequence': {
      const seq = String(rule.start + ctx.index * rule.step).padStart(rule.width, '0')
      return rule.position === 'front' ? seq + rule.sep + name : name + rule.sep + seq
    }
    case 'timestamp': {
      const t = rule.source === 'mtime' && ctx.mtime != null ? ctx.mtime : Date.now()
      return rule.position === 'front'
        ? formatStamp(t, rule.format) + rule.sep + name
        : name + rule.sep + formatStamp(t, rule.format)
    }
    case 'case':
      if (rule.mode === 'upper') return name.toUpperCase()
      if (rule.mode === 'lower') return name.toLowerCase()
      return name.charAt(0).toUpperCase() + name.slice(1)
    case 'remove':
      if (rule.mode === 'chars') {
        const set = new Set(rule.chars)
        return [...name].filter((c) => !set.has(c)).join('')
      }
      // range：按 Unicode 字符计数，从 start(1 起) 删 count 个
      const chars = [...name]
      const startIdx = rule.start - 1
      if (startIdx < 0 || startIdx >= chars.length) return name
      return chars.slice(0, startIdx).concat(chars.slice(startIdx + rule.count)).join('')
    default:
      return name
  }
}

function applyReplace(name: string, rule: ReplaceRule): string {
  if (!rule.find) return name
  if (rule.regex) {
    try {
      const flags = rule.onlyFirst ? 'u' : 'gu'
      return name.replace(new RegExp(rule.find, flags), rule.with)
    } catch {
      return name
    }
  }
  if (rule.onlyFirst) return name.replace(rule.find, rule.with)
  return name.split(rule.find).join(rule.with)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-rename-build.ts`
Expected: `全部通过`（0 失败）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/rename/build.ts scripts/verify-rename-build.ts
git commit -m "feat(rename): add buildName pure function with verify script"
```

---

### Task 3: 差异高亮 diff.ts

**Files:**
- Create: `src/lib/rename/diff.ts`
- Create: `scripts/verify-rename-diff.ts`

- [ ] **Step 1: 编写失败的自检脚本**

`scripts/verify-rename-diff.ts`：

```ts
// diff.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-diff.ts
import { diffSegments } from '../src/lib/rename/diff.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
// 便捷断言：把 seg 序列化成类型串，如 'IMG_001' 增删后
const typeString = (a: string, b: string) => diffSegments(a, b).map((s) => s.type).join('')

console.log('无差异')
check('identical -> same', typeString('IMG_001', 'IMG_001') === 'same')

console.log('前缀新增')
check('prefix add', diffSegments('IMG_001', '01_IMG_001').some((s) => s.type === 'add'))

console.log('增删并存')
check('has add', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'add'))
check('has del', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'del'))
check('has same', diffSegments('IMG_001', '01_IMG_00X').some((s) => s.type === 'same'))
check('拼接还原新串', diffSegments('IMG_001', '01_IMG_00X').map((s) => s.text).join('') === '01_IMG_00X')
check('全不同为 del+add 两段', diffSegments('a', 'b').length === 2)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-rename-diff.ts`
Expected: 报错（找不到 `diff.ts`）。

- [ ] **Step 3: 实现 diff.ts**

```ts
// diff.ts：字符级差异，返回带类型的文本段，供预览高亮（增绿删红）
export type DiffType = 'same' | 'add' | 'del'
export interface DiffSegment { type: DiffType; text: string }

export function diffSegments(oldName: string, newName: string): DiffSegment[] {
  if (oldName === newName) return [{ type: 'same', text: newName }]
  if (!oldName) return [{ type: 'add', text: newName }]
  if (!newName) return [{ type: 'del', text: oldName }]
  // LCS 最长公共子序列
  const a = [...oldName]
  const b = [...newName]
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const segs: DiffSegment[] = []
  let i = 0
  let j = 0
  let bufSame = ''
  let bufAdd = ''
  let bufDel = ''
  const flush = (type: DiffType | null): void => {
    if (bufSame) { segs.push({ type: 'same', text: bufSame }); bufSame = '' }
    if (bufDel) { segs.push({ type: 'del', text: bufDel }); bufDel = '' }
    if (bufAdd) { segs.push({ type: 'add', text: bufAdd }); bufAdd = '' }
  }
  while (i < n && j < m) {
    if (a[i] === b[j]) { flush('same'); bufSame += a[i]; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { flush(null); bufDel += a[i]; i++ }
    else { flush(null); bufAdd += b[j]; j++ }
  }
  while (i < n) { bufDel += a[i]; i++ }
  while (j < m) { bufAdd += b[j]; j++ }
  flush('same')
  return segs
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-rename-diff.ts`
Expected: `全部通过`。

- [ ] **Step 5: 提交**

```bash
git add src/lib/rename/diff.ts scripts/verify-rename-diff.ts
git commit -m "feat(rename): add diff highlighting with verify script"
```

---

### Task 4: 冲突检测与自动补序号 conflict.ts

**Files:**
- Create: `src/lib/rename/conflict.ts`
- Create: `scripts/verify-rename-conflict.ts`

- [ ] **Step 1: 编写失败的自检脚本**

`scripts/verify-rename-conflict.ts`：

```ts
// conflict.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-conflict.ts
import { flagConflicts, uniquify } from '../src/lib/rename/conflict.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('flagConflicts')
const names = ['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg']
const flags = flagConflicts(names)
check('重复的 a 标为冲突', flags[0] === true && flags[2] === true)
check('唯一项非冲突', flags[1] === false && flags[3] === false)
check('空数组', flagConflicts([]).length === 0)

console.log('uniquify')
const u = uniquify(['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg'])
check('去重后唯一', new Set(u).size === u.length)
check('保留首个为原名', u[0] === 'a.jpg' && u[2] === 'a (2).jpg')
check('非冲突项不变', u[1] === 'b.jpg' && u[3] === 'c.jpg')
const back = uniquify(['x', 'x', 'x'])
check('多重复依次递增', back[0] === 'x' && back[1] === 'x (2)' && back[2] === 'x (3)')

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-rename-conflict.ts`
Expected: 报错（找不到 `conflict.ts`）。

- [ ] **Step 3: 实现 conflict.ts**

```ts
// conflict.ts：新名冲突检测与自动补序号
// 名字含扩展名时，增序号插在扩展名之前（见 splitName）

/** 返回每个下标是否与其它项同名 */
export function flagConflicts(names: string[]): boolean[] {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return names.map((n) => (counts.get(n) ?? 0) > 1)
}

/** 在不改变传入数组的前提下返回唯一化后的新数组，重复项追加 ` (2)`、` (3)`… */
export function uniquify(names: string[]): string[] {
  const out: string[] = []
  const used = new Set<string>()
  for (const name of names) {
    if (!used.has(name)) {
      out.push(name)
      used.add(name)
      continue
    }
    let k = 2
    let candidate = appendNum(name, k)
    while (used.has(candidate)) {
      k++
      candidate = appendNum(name, k)
    }
    out.push(candidate)
    used.add(candidate)
  }
  return out
}

/** 在扩展名前插入 ` (k)`：`a.jpg` -> `a (2).jpg`；无扩展名则直接在末尾追加 */
function appendNum(name: string, k: number): string {
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return `${name} (${k})`
  return `${name.slice(0, idx)} (${k})${name.slice(idx)}`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-rename-conflict.ts`
Expected: `全部通过`。

- [ ] **Step 5: 提交**

```bash
git add src/lib/rename/conflict.ts scripts/verify-rename-conflict.ts
git commit -m "feat(rename): add conflict detection and auto numbering"
```

---

### Task 5: 预览组装 preview.ts

**Files:**
- Create: `src/lib/rename/preview.ts`
- Create: `scripts/verify-rename-preview.ts`

- [ ] **Step 1: 编写失败的自检脚本**

`scripts/verify-rename-preview.ts`：

```ts
// preview.ts 逻辑自检脚本
// 运行：node scripts/verify-rename-preview.ts
import { batchPreview, type FileEntry2 } from '../src/lib/rename/preview.ts'
import type { Rule } from '../src/lib/rename/rules.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

const files: FileEntry2[] = [
  { name: 'IMG_001.jpg', mtime: new Date('2026-08-22T10:30:00').getTime(), handle: null },
  { name: 'IMG_002.png', mtime: new Date('2026-08-22T10:30:00').getTime(), handle: null },
]

console.log('基本替换')
const rules: Rule[] = [{ type: 'replace', find: 'IMG', with: 'Photo', onlyFirst: false, regex: false }]
const rows = batchPreview(files, rules)
check('行数', rows.length === 2)
check('新旧完整名', rows[0].old === 'IMG_001.jpg' && rows[0].new === 'Photo_001.jpg')
check('changed', rows[0].changed === true)
check('保留扩展名', rows[1].new === 'Photo_002.png')

console.log('extend 规则')
const extRule: Rule = { type: 'extension', mode: 'replace', ext: 'txt' }
const rows2 = batchPreview(files, extRule, {})
check('替换扩展名', rows2[0].new === 'IMG_001.txt')

console.log('冲突')
const clashFiles: FileEntry2[] = [
  { name: 'a.jpg', mtime: 0, handle: null },
  { name: 'b.jpg', mtime: 0, handle: null },
]
const clash = batchPreview(clashFiles, [{ type: 'replace', find: 'b', with: 'a', onlyFirst: false, regex: false }], {})
check('冲突标记', clash[1].conflict === true)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-rename-preview.ts`
Expected: 报错（找不到 `preview.ts`）。

- [ ] **Step 3: 实现 preview.ts**

```ts
// preview.ts：把"文件列表 + 规则"组装成逐行预览结果
import { buildName, type BuildContext } from './build'
import { flagConflicts, uniquify } from './conflict'
import { isRuleActive, type Rule } from './rules'

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
  const ext = extRuleOf(rules) as { type: 'extension'; mode: 'keep' | 'replace'; ext: string } | undefined

  const rawNew = files.map((f, index) => {
    const [stem, oldExt] = splitName(f.name)
    const ctx: BuildContext = { index, mtime: f.mtime }
    const nonExt = active.filter((r) => r.type !== 'extension')
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

  // 脏重名冲突：只对准备应用的(changed 且非 invalid)行标记
  const candidates = rows
    .map((r, i) => (r.changed && !r.invalid ? i : -1))
    .filter((i) => i >= 0)
  const candNames = candidates.map((i) => rows[i].new)
  const conf = flagConflicts(candNames)
  candidates.forEach((idx, k) => {
    if (conf[k]) rows[idx].conflict = true
  })

  if (opts.autoNumber) {
    // 对全部新名统一 uniquify（含未变更项，保证整体唯一），再回填
    const uniq = uniquify(rawNew)
    rows.forEach((r, i) => {
      r.new = uniq[i]
      r.changed = uniq[i] !== r.old
      r.invalid = invalidReason(r.new)
    })
    // 重新计算冲突（此时应无冲突，除非原名本就重复）
    const names2 = rows.map((r) => r.new)
    const conf2 = flagConflicts(names2)
    rows.forEach((r, i) => { r.conflict = conf2[i] })
  }

  return rows
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-rename-preview.ts`
Expected: `全部通过`。

> 注：脚本传入 `{ index: undefined }` / `{}` 均可（可选参数），`batchPreview` 的 `opts` 参数结构一致即可。

- [ ] **Step 5: 提交**

```bash
git add src/lib/rename/preview.ts scripts/verify-rename-preview.ts
git commit -m "feat(rename): add batch preview assembly"
```

---

### Task 6: IndexedDB 撤销栈 history.ts

**Files:**
- Create: `src/lib/rename/history.ts`

这部分是浏览器 API（IndexedDB），无法用 node 脚本直接跑，验证方式 = `npm run build` 类型通过 + 浏览器手测（Application → IndexedDB 可见记录）。

- [ ] **Step 1: 实现 history.ts**

```ts
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
```

- [ ] **Step 2: 类型校验**

Run: `npx vue-tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/lib/rename/history.ts
git commit -m "feat(rename): add indexedDB undo stack"
```

---

### Task 7: FS Access API 封装 fsaccess.ts

**Files:**
- Create: `src/lib/rename/fsaccess.ts`

同样为浏览器 API，验证 = 类型通过 + 浏览器手测。

- [ ] **Step 1: 实现 fsaccess.ts**

```ts
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
```

- [ ] **Step 2: 类型校验**

Run: `npx vue-tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/lib/rename/fsaccess.ts
git commit -m "feat(rename): add FS Access API wrapper"
```

---

### Task 8: 规则块组件 RuleBlock.vue

**Files:**
- Create: `src/components/rename/RuleBlock.vue`

- [ ] **Step 1: 实现 RuleBlock.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { createRule, RULE_TYPES, RULE_LABEL, TIMESTAMP_FORMATS, type Rule, type RuleType } from '@/lib/rename/rules'

const props = defineProps<{ rule: Rule; index: number; canUp: boolean; canDown: boolean }>()
const emit = defineEmits<{
  (e: 'update:rule', rule: Rule): void
  (e: 'remove'): void
  (e: 'move', dir: -1 | 1): void
}>()

const label = computed(() => RULE_LABEL[props.rule.type as RuleType])

function setType(t: RuleType) {
  emit('update:rule', createRule(t))
}
function patch(p: Partial<Record<string, unknown>>) {
  emit('update:rule', { ...props.rule, ...p })
}
</script>

<template>
  <div class="space-y-3 rounded-lg border p-3">
    <div class="flex items-center gap-2">
      <button class="text-sm font-medium" @click="setType(rule.type)">{{ label }}</button>
      <select class="rounded-md border border-input bg-background px-2 py-1 text-xs" :value="rule.type" @change="setType(($event.target as HTMLSelectElement).value as RuleType)">
        <option v-for="t in RULE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <div class="ml-auto flex items-center gap-1">
        <button class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canUp" @click="emit('move', -1)">↑</button>
        <button class="rounded border border-input px-1.5 text-xs disabled:opacity-40" :disabled="!canDown" @click="emit('move', 1)">↓</button>
        <button class="rounded border border-input px-1.5 text-xs hover:bg-destructive/10 hover:text-destructive" @click="emit('remove')">✕</button>
      </div>
    </div>

    <!-- 查找-替换 -->
    <div v-if="rule.type === 'replace'" class="grid gap-2 text-xs">
      <label class="flex items-center gap-2">
        查找
        <input v-model="rule.find" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="IMG_">
      </label>
      <label class="flex items-center gap-2">
        替换为
        <input v-model="rule.with" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="保留为空则删除">
      </label>
      <label class="flex items-center gap-2"><input v-model="rule.onlyFirst" type="checkbox"> 仅替换首个</label>
      <details class="text-xs"><summary>高级：正则</summary>
        <label class="flex items-center gap-2 mt-1"><input v-model="rule.regex" type="checkbox"> 当作正则表达式</label>
      </details>
    </div>

    <!-- 前缀/后缀 -->
    <div v-if="rule.type === 'prefix' || rule.type === 'suffix'" class="flex items-center gap-2 text-xs">
      {{ rule.type === 'prefix' ? '前缀文本' : '后缀文本' }}
      <input v-model="rule.text" class="flex-1 rounded-md border border-input bg-background px-2 py-1" placeholder="例如 2025-">
    </div>

    <!-- 序号 -->
    <div v-if="rule.type === 'sequence'" class="grid grid-cols-2 gap-2 text-xs">
      <label>起始 <input v-model.number="rule.start" type="number" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>步长 <input v-model.number="rule.step" type="number" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>位数 <input v-model.number="rule.width" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label>分隔符 <input v-model="rule.sep" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      <label class="col-span-2 flex items-center gap-2">位置
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="front"> 前</label>
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="back"> 后</label>
      </label>
    </div>

    <!-- 时间戳 -->
    <div v-if="rule.type === 'timestamp'" class="grid gap-2 text-xs">
      <label>格式
        <select v-model="rule.format" class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs">
          <option v-for="f in TIMESTAMP_FORMATS" :key="f" :value="f">{{ f }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2">来源
        <label class="flex items-center gap-1"><input v-model="rule.source" type="radio" value="mtime"> 文件修改时间</label>
        <label class="flex items-center gap-1"><input v-model="rule.source" type="radio" value="now"> 当前时间</label>
      </label>
      <label class="flex items-center gap-2">位置
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="front"> 前</label>
        <label class="flex items-center gap-1"><input v-model="rule.position" type="radio" value="back"> 后</label>
      </label>
      <label>分隔符 <input v-model="rule.sep" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
    </div>

    <!-- 大小写 -->
    <div v-if="rule.type === 'case'" class="flex items-center gap-2 text-xs">
      <select v-model="rule.mode" class="rounded-md border border-input bg-background px-2 py-1 text-xs">
        <option value="upper">全大写</option>
        <option value="lower">全小写</option>
        <option value="cap">首字母大写</option>
      </select>
    </div>

    <!-- 删除字符 -->
    <div v-if="rule.type === 'remove'" class="grid gap-2 text-xs">
      <label class="flex items-center gap-2">方式
        <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="range"> 删固定位</label>
        <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="chars"> 删字符集</label>
      </label>
      <template v-if="rule.mode === 'range'">
        <label>从第几位删(1起) <input v-model.number="rule.start" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
        <label>删几位 <input v-model.number="rule.count" type="number" min="1" class="w-full rounded-md border border-input bg-background px-2 py-1"></label>
      </template>
      <label v-else>删除的字符(可多选) <input v-model="rule.chars" class="w-full rounded-md border border-input bg-background px-2 py-1" placeholder="例如 abc#"></label>
      <details class="text-xs"><summary>高级：正则</summary><span>删除字符集暂不支持正则，请直接输入字符。</span></details>
    </div>

    <!-- 扩展名 -->
    <div v-if="rule.type === 'extension'" class="flex items-center gap-2 text-xs">
      <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="keep"> 保留</label>
      <label class="flex items-center gap-1"><input v-model="rule.mode" type="radio" value="replace"> 替换为</label>
      <input v-if="rule.mode === 'replace'" v-model="rule.ext" class="w-28 rounded-md border border-input bg-background px-2 py-1" placeholder="jpg">
    </div>
  </div>
</template>
```

> 说明：表单里 `v-model="rule.find"` 等直接改 props 对象字段是可透传的（父组件持有该对象引用），`patch`/`setType` 用于类型变更与整体替换，确保响应式更新。`start`/`width`/`count` 用 `v-model.number`。

- [ ] **Step 2: 类型校验**

Run: `npx vue-tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/components/rename/RuleBlock.vue
git commit -m "feat(rename): add RuleBlock config form"
```

---

### Task 9: 页面视图 Rename.vue

**Files:**
- Create: `src/views/Rename.vue`

- [ ] **Step 1: 实现 Rename.vue**

直接写入这个完整、无占位的最终版：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import RuleBlock from '@/components/rename/RuleBlock.vue'
import { createRule, type Rule, type RuleType } from '@/lib/rename/rules'
import { batchPreview, type FileEntry2 } from '@/lib/rename/preview'
import { diffSegments } from '@/lib/rename/diff'
import { detectFsAccess, pickDirectory, commitRenames, revertBatch } from '@/lib/rename/fsaccess'
import { popHistory } from '@/lib/rename/history'

const router = useRouter()
const { toast } = useToaster()

const isFsAccess = detectFsAccess()
const files = ref<FileEntry2[]>([])
const rules = ref<Rule[]>([])
const include = ref<boolean[]>([])
const autoNumber = ref(false)
const undoAvailable = ref(false)
const addType = ref<RuleType>('replace')

const rows = computed(() => {
  const r = batchPreview(files.value, rules.value, { autoNumber: autoNumber.value })
  return r.map((row, i) => ({ ...row, skipped: !include.value[i] }))
})

const stats = computed(() => {
  const vis = rows.value.filter((r, i) => include.value[i])
  return {
    total: files.value.length,
    willChange: vis.filter((r) => r.changed && !r.invalid).length,
    conflict: vis.filter((r) => r.conflict).length,
    invalid: vis.filter((r) => !!r.invalid).length,
  }
})

async function handlePick() {
  const entries = await pickDirectory()
  if (!entries || entries.length === 0) return
  files.value = entries
  include.value = entries.map(() => true)
  undoAvailable.value = false
}

function handleFileInput(e: Event) {
  const el = e.target as HTMLInputElement
  if (!el.files) return
  const f2: FileEntry2[] = Array.from(el.files).map((f) => ({
    name: f.name, size: f.size, type: f.type, mtime: f.lastModified || Date.now(), handle: null,
  }))
  files.value = f2
  include.value = f2.map(() => true)
}

// 拖拽：FS Access 支持时取目录句柄；否则回退到 DataTransfer.files
function onDrop(e: DragEvent) {
  e.preventDefault()
  const dt = e.dataTransfer
  if (!dt) return
  if (isFsAccess && [...dt.items].some((it) => it.kind === 'file')) {
    const item = [...dt.items].find((it) => it.kind === 'file')
    item?.getAsFileSystemHandle().then((h) => {
      if (h?.kind === 'directory') {
        setFromDir(h as FileSystemDirectoryHandle)
      } else if (h?.kind === 'file') {
        const f2: FileEntry2[] = [{ name: h.name, mtime: Date.now(), handle: h as FileSystemFileHandle }]
        files.value = f2
        include.value = [true]
      }
    })
    return
  }
  if (dt.files) handleFileInput({ target: { files: dt.files } } as unknown as Event)
}

async function setFromDir(dir: FileSystemDirectoryHandle) {
  const out: FileEntry2[] = []
  for await (const [, hh] of dir.entries()) {
    if (hh.kind !== 'file') continue
    const fh = hh as FileSystemFileHandle
    let mtime = Date.now()
    let size = 0
    try { const f = await fh.getFile(); mtime = f.lastModified; size = f.size } catch { /* 忽略 */ }
    out.push({ name: fh.name, size, mtime, handle: fh })
  }
  files.value = out
  include.value = out.map(() => true)
}

function removeFile(i: number) {
  files.value.splice(i, 1)
  include.value.splice(i, 1)
}

// 规则 CRUD
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

// 应用更改 / 导出 的公共入口（真写盘或只读导出）
async function applyChanges() {
  const dir = (files.value[0]?.handle ?? null) as FileSystemDirectoryHandle | null
  if (!isFsAccess || !dir) { exportList(); return }
  const targets = rows.value
    .filter((r, i) => include.value[i] && r.changed && !r.invalid)
    .map((r) => ({ oldName: r.old, newName: r.new }))
  if (!targets.length) return
  const res = await commitRenames(dir, targets)
  if (res.failed.length) {
    toast(undefined, `部分失败：${res.failed.join(', ')}`)
    return
  }
  undoAvailable.value = true
  // 本地同步为新名，保持预览一致（避免重新弹选夹）
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
  undoAvailable.value = false
  toast(undefined, failed.length ? `撤销部分失败：${failed.join(', ')}` : '已撤销')
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" @click="router.push('/')">← 返回</button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">文件批量重命名</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          v-if="isFsAccess"
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handlePick"
        >📁 选文件夹</button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          :disabled="!undoAvailable"
          @click="undo"
        >撤销</button>
      </div>
    </div>

    <!-- 只读能力边界提示 -->
    <div
      v-if="!isFsAccess"
      class="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
    >⚠️ 当前环境无法直接修改磁盘文件，仅支持预览与导出改名列表（浏览器限制，建议使用 Chrome/Edge 或桌面版）。</div>

    <!-- 文件区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">📂 文件区</div>
      <div
        class="flex flex-col items-center gap-1 px-4 py-6 text-sm text-muted-foreground border-b border-dashed"
        @dragover.prevent
        @drop="onDrop"
      >
        <span>拖拽文件夹/文件到此处</span>
        <label class="mt-1 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          或选择文件
          <input type="file" multiple class="hidden" @change="handleFileInput">
        </label>
      </div>
      <ul v-if="files.length" class="max-h-56 overflow-auto divide-y divide-border">
        <li v-for="(f, i) in files" :key="i" class="flex items-center gap-2 px-3 py-1.5 text-sm">
          <span class="truncate">{{ f.name }}</span>
          <span class="ml-auto shrink-0 text-xs text-muted-foreground">
            {{ f.size != null ? (f.size / 1024).toFixed(1) + ' KB' : '' }}
            <span class="mx-0.5">·</span>{{ f.type || '文件' }}
          </span>
          <button class="shrink-0 rounded border border-input px-1.5 text-xs hover:bg-destructive/10 hover:text-destructive" @click="removeFile(i)">✕</button>
        </li>
      </ul>
    </div>

    <!-- 规则区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>🧰 规则（从上到下依次作用）</span>
        <div class="ml-auto flex items-center gap-2">
          <select v-model="addType" class="rounded-md border border-input bg-background px-2 py-1 text-xs">
            <option v-for="t in ['replace','prefix','suffix','sequence','timestamp','case','remove','extension']" :key="t" :value="t">{{ t }}</option>
          </select>
          <button class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="addRule">+ 添加规则</button>
        </div>
      </div>
      <div v-if="rules.length" class="space-y-3 p-3">
        <RuleBlock
          v-for="(r, i) in rules"
          :key="i"
          :rule="r"
          :index="i"
          :can-up="i > 0"
          :can-down="i < rules.length - 1"
          @update:rule="updateRule(i, $event)"
          @remove="removeRule(i)"
          @move="moveRule(i, $event)"
        />
      </div>
      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">点击右上角"添加规则"开始配置</div>
    </div>

    <!-- 预览区 -->
    <div class="flex flex-col rounded-lg border">
      <div class="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>👁️ 预览（勾选应用，增绿删红）</span>
        <label class="ml-auto flex items-center gap-1 text-xs text-muted-foreground normal-case">
          <input v-model="autoNumber" type="checkbox"> 冲突自动加序号
        </label>
      </div>
      <ul v-if="rows.length" class="max-h-72 overflow-auto divide-y divide-border">
        <li
          v-for="(r, i) in rows"
          :key="i"
          class="flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          <input v-model="include[i]" type="checkbox" class="shrink-0">
          <div class="min-w-0 flex-1 truncate font-mono text-xs">
            <span class="text-muted-foreground line-through">{{ r.old }}</span>
            <span class="mx-1 text-muted-foreground">→</span>
            <template v-if="r.new === r.old">
              <span class="text-muted-foreground">{{ r.old }}</span>
            </template>
            <template v-else-if="r.invalid">
              <span class="text-destructive">{{ r.new }}</span>
            </template>
            <template v-else>
              <span v-for="(sg, k) in diffSegments(r.old, r.new)" :key="k"
                :class="{ 'text-emerald-600 dark:text-emerald-400': sg.type === 'add', 'text-destructive': sg.type === 'del' }">
                {{ sg.text }}
              </span>
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
      <button
        v-if="isFsAccess"
        class="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        :disabled="!stats.willChange || stats.conflict > 0 || stats.invalid > 0"
        @click="applyChanges"
      >应用更改</button>
      <button
        v-else
        class="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        :disabled="!stats.willChange"
        @click="exportList"
      >导出改名列表</button>
    </div>
  </div>
</template>
```

> 说明：rule 字段由 RuleBlock 内的 `v-model` 直接写响应式对象（放入 `rules` ref 数组后自动深度响应式），`rows` 计算属性会随之重算；类型变更走 `update:rule` 事件整体替换。`include[i]` 的 v-model 与 `stats` 同步底栏计数。

- [ ] **Step 2: 类型校验**

Run: `npx vue-tsc --noEmit`
Expected: 无报错。

- [ ] **Step 3: 提交**

```bash
git add src/views/Rename.vue
git commit -m "feat(rename): add rename view page"
```

---

### Task 10: 路由注册 + 首页卡片

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/Home.vue`

- [ ] **Step 1: 注册路由**

在 `src/router/index.ts` 的 routes 数组中、`/arch-os` 之后追加：

```ts
    {
      path: '/rename',
      name: 'rename',
      component: () => import('@/views/Rename.vue'),
    },
```

- [ ] **Step 2: 首页加卡片**

在 `src/views/Home.vue` 的 `tools` 数组末尾追加：

```ts
  {
    icon: '📁',
    name: '文件批量重命名',
    description: '可视化规则块 + 实时预览，批量重命名文件并在桌面端真正写盘',
    route: '/rename',
    tag: 'v1.0',
  },
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功（含 `vue-tsc --noEmit` 与 `vite build`），无类型错误。

- [ ] **Step 4: 提交**

```bash
git add src/router/index.ts src/views/Home.vue
git commit -m "feat(rename): register route and home card"
```

---

### Task 11: 汇总自检与收尾

**Files:**
- 全部 `scripts/verify-rename-*.ts`

- [ ] **Step 1: 运行全部自检脚本**

Run: `node scripts/verify-rename-build.ts && node scripts/verify-rename-diff.ts && node scripts/verify-rename-conflict.ts && node scripts/verify-rename-preview.ts`
Expected: 四个脚本均输出 `全部通过`。

- [ ] **Step 2: 类型 + 构建**

Run: `npm run build`
Expected: 成功，无报错。

- [ ] **Step 3: 手动浏览器验证清单（在支持 FS Access 的 Chrome/Edge 下 `npm run dev` 走查）**
- [ ] 点击"选文件夹"，文件区列出文件（名/大小/类型/修改时间）
- [ ] 添加替换规则，预览即时更新，差异增绿删红
- [ ] 冲突行红标；开启"自动加序号"后消解
- [ ] 勾选/取消某行 → 底栏"将改 M"相应变化
- [ ] 应用更改 → 盘上文件确实改名；撤销 → 恢复原名
- [ ] 在不支持的 webview（如 macOS Safari/WKWebView）下走 `/rename`：顶部显示只读横幅，按钮为"导出改名列表"

- [ ] **Step 4: 最终提交（连同本计划）**

```bash
git add -A
git commit -m "feat(rename): finalize file batch rename tool"
```

---

## Self-Review 记录

- **Spec 覆盖**：七种规则（rules.ts + build.ts）✔；实时预览（preview.ts + Rename.vue）✔；差异高亮（diff.ts）✔；冲突 + 自动补序号（conflict.ts + autoNumber）✔；真实写盘（fsaccess.ts commitRenames）✔；IndexedDB 撤销（history.ts + undo）✔；能力降级只读导出（detectFsAccess + exportList + 只读横幅）✔；路由 + 首页卡片 ✔；边界（空名/非法字符/超长 invalidReason、Unicode 用 [...str]）✔。
- **占位扫描**：所有 task 均含完整实现代码，无 TBD/TODO/占位。Task 9 的 `Rename.vue` 为单一完整实现。
- **类型一致性**：`Rule`/`RuleType`/`FileEntry2`/`PreviewRow`/`BuildContext` 在所有 task 中签名一致；`buildName(stem, rules, ctx)`、`batchPreview(files, rules, opts)`、`diffSegments(a,b)`、`flagConflicts(names)`/`uniquify(names)`、`commitRenames(dir, ops)`/`revertBatch(dir, ops)`/`popHistory()` 前后一致。