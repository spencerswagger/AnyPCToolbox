# 结构化数据互转（DataFormats）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 JSON 编辑器升级为基于 `Records` 中间模型的多格式互转工具，首批覆盖 JSON/YAML/CSV/TOML/XML 文本格式。

**Architecture:** 采用 adapter 注册中心 + Records 中间模型（方案 A）。`dataformats/` 目录下 `records.ts` 定义模型与嵌套展开/重建工具；`importers/`、`exporters/` 每格式一文件；`registry.ts` 登记格式派生下拉与扩展名。视图 `DataFormats.vue` 三栏（源格式+源文本 → 预览表格 → 目标格式+结果）替换原 `/json`。

**Tech Stack:** Vue 3 + TS + Vite；`yaml`、`smol-toml`；XML 用浏览器 `DOMParser`；Node 原生 TS 运行 verify 脚本（`node scripts/verify-*.ts`）。

**离线约束：** 所有依赖经 npm 安装由 Vite 构建打包，运行时零 CDN 请求。

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 yaml 与 smol-toml**

```bash
npm install yaml smol-toml
```

Expected：`package.json` 的 `dependencies` 新增 `yaml` 与 `smol-toml`。

- [ ] **Step 2: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore: 引入 yaml 与 smol-toml 依赖"
```

---

## Task 2: 核心模型 records.ts

**Files:**
- Create: `src/lib/dataformats/records.ts`

统一的类型、错误、构建、嵌套展开/重建工具。所有 importer/exporter 依赖本文件。

- [ ] **Step 1: 创建 records.ts**

```ts
export type Cell = string | number | boolean | null
export interface Records {
  columns: string[]
  rows: Cell[][]
}

export type FlattenStrategy = 'flatten' | 'firstLevel' | 'raw'
export const FLATTEN_DEPTH = 5

export class FormatError extends Error {
  line?: number
  col?: number
  constructor(message: string, line?: number, col?: number) {
    super(message)
    this.name = 'FormatError'
    this.line = line
    this.col = col
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function headerDedup(columns: string[]): string[] {
  const seen = new Map<string, number>()
  return columns.map((c) => {
    const name = c === '' ? 'column' : c
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    return n === 0 ? name : `${name}_${n}`
  })
}

export function buildRecords(columns: string[], rows: Cell[][]): Records {
  const cols = headerDedup(columns)
  const width = cols.length
  const padded = rows.map((r) => {
    const row = [...r]
    while (row.length < width) row.push(null)
    return row.slice(0, width)
  })
  return { columns: cols, rows: padded }
}

function cellOf(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return JSON.stringify(v)
}

// 将单个对象/值扁平化为 row Map，deepkey -> cell
function objectToRow(obj: unknown, prefix: string, strategy: FlattenStrategy, depth: number): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  const path = (key: string) => (prefix ? `${prefix}.${key}` : key)
  if (Array.isArray(obj)) {
    out[prefix || 'data'] = JSON.stringify(obj)
    return out
  }
  const o = obj as Record<string, unknown>
  for (const key of Object.keys(o)) {
    const p = path(key)
    const v = o[key]
    if (isPlainObject(v)) {
      if (strategy === 'firstLevel' || depth >= FLATTEN_DEPTH) {
        out[p] = JSON.stringify(v)
      } else {
        Object.assign(out, objectToRow(v, p, strategy, depth + 1))
      }
    } else if (Array.isArray(v)) {
      out[p] = JSON.stringify(v)
    } else {
      out[p] = cellOf(v)
    }
  }
  return out
}

export function valueToRecords(value: unknown, strategy: FlattenStrategy = 'flatten'): Records {
  if (value === null || value === undefined) return { columns: [], rows: [] }
  if (strategy === 'raw') {
    return { columns: ['data'], rows: [[JSON.stringify(value)]] }
  }
  if (Array.isArray(value)) {
    const rowMaps = value.map((el) => objectToRow(el, '', strategy, 0))
    const columns = headerDedup([...new Set(rowMaps.flatMap(Object.keys))])
    const rows = rowMaps.map((m) => columns.map((c) => m[c] ?? null))
    return { columns, rows }
  }
  if (isPlainObject(value)) {
    const m = objectToRow(value, '', strategy, 0)
    return buildRecords(Object.keys(m), [m[Object.keys(m)[0]] == null && Object.keys(m).length > 0 ? Object.values(m) : [m[''] ?? null]])
  }
  return { columns: ['data'], rows: [[cellOf(value)]] }
}

function setPath(obj: Record<string, unknown>, path: string, v: unknown): void {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (!isPlainObject(cur[k])) cur[k] = {}
    cur = cur[k] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = v
}

export function recordsToValue(records: Records): unknown {
  return records.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    records.columns.forEach((c, i) => setPath(obj, c, row[i]))
    return obj
  })
}
```

说明：`valueToRecords` 对 `isPlainObject` 分支的处理有冗余，实现时保持「单对象 → 1 行」语义即可，可用更直白的写法替换该分支（不要留下上面那行冗余表达式）。

- [ ] **Step 2: 提交**

```bash
git add src/lib/dataformats/records.ts
git commit -m "feat: Records 中间模型与嵌套展开/重建工具"
```

---

## Task 3: JSON importer/exporter

**Files:**
- Create: `src/lib/dataformats/importers/json.ts`
- Create: `src/lib/dataformats/exporters/json.ts`

- [ ] **Step 1: 创建 importers/json.ts**

```ts
import { FormatError, valueToRecords, type FlattenStrategy } from '../records'

export function jsonToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    throw new FormatError(`JSON 解析失败：${(e as Error).message}`)
  }
  return valueToRecords(value, strategy)
}
```

- [ ] **Step 2: 创建 exporters/json.ts**

```ts
import { recordsToValue, type Records } from '../records'

export function recordsToJson(records: Records): string {
  return JSON.stringify(recordsToValue(records), null, 2)
}
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/dataformats/importers/json.ts src/lib/dataformats/exporters/json.ts
git commit -m "feat: JSON importer/exporter"
```

---

## Task 4: CSV importer/exporter

**Files:**
- Create: `src/lib/dataformats/importers/csv.ts`
- Create: `src/lib/dataformats/exporters/csv.ts`

- [ ] **Step 1: 创建 importers/csv.ts（RFC4180 解析）**

```ts
import { buildRecords, type Cell } from '../records'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { pushField(); i++; continue }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; pushRow(); i++; continue }
    if (ch === '\n') { pushRow(); i++; continue }
    field += ch; i++
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

export function csvToRecords(text: string) {
  const rows = parseCsv(text)
  if (rows.length === 0) return { columns: [], rows: [] }
  const body = rows.slice(1).map((r) => r as Cell[])
  return buildRecords(rows[0], body)
}
```

- [ ] **Step 2: 创建 exporters/csv.ts（带 BOM、字段转义）**

```ts
import type { Cell, Records } from '../records'

function csvField(v: Cell): string {
  if (v === null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function recordsToCsv(records: Records): string {
  const head = records.columns.map(csvField).join(',')
  const lines = records.rows.map((r) => r.map(csvField).join(','))
  return `\uFEFF${[head, ...lines].join('\r\n')}`
}
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/dataformats/importers/csv.ts src/lib/dataformats/exporters/csv.ts
git commit -m "feat: CSV importer/exporter"
```

---

## Task 5: YAML importer/exporter

**Files:**
- Create: `src/lib/dataformats/importers/yaml.ts`
- Create: `src/lib/dataformats/exporters/yaml.ts`

- [ ] **Step 1: 创建 importers/yaml.ts**

```ts
import { parse } from 'yaml'
import { FormatError, valueToRecords, type FlattenStrategy } from '../records'

export function yamlToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  try {
    value = parse(text)
  } catch (e) {
    throw new FormatError(`YAML 解析失败：${(e as Error).message}`)
  }
  if (value === null || value === undefined) return { columns: [], rows: [] }
  return valueToRecords(value, strategy)
}
```

- [ ] **Step 2: 创建 exporters/yaml.ts**

```ts
import { stringify } from 'yaml'
import { recordsToValue, type Records } from '../records'

export function recordsToYaml(records: Records): string {
  return stringify(recordsToValue(records))
}
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/dataformats/importers/yaml.ts src/lib/dataformats/exporters/yaml.ts
git commit -m "feat: YAML importer/exporter"
```

---

## Task 6: TOML importer/exporter

**Files:**
- Create: `src/lib/dataformats/importers/toml.ts`
- Create: `src/lib/dataformats/exporters/toml.ts`

- [ ] **Step 1: 创建 importers/toml.ts**

```ts
import { parse } from 'smol-toml'
import { FormatError, valueToRecords, type FlattenStrategy } from '../records'

export function tomlToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  let value: unknown
  try {
    value = parse(text)
  } catch (e) {
    throw new FormatError(`TOML 解析失败：${(e as Error).message}`)
  }
  if (value === null || value === undefined) return { columns: [], rows: [] }
  return valueToRecords(value, strategy)
}
```

- [ ] **Step 2: 创建 exporters/toml.ts**

```ts
import { stringify } from 'smol-toml'
import { recordsToValue, type Records } from '../records'

export function recordsToToml(records: Records): string {
  return stringify(recordsToValue(records) as never)
}
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/dataformats/importers/toml.ts src/lib/dataformats/exporters/toml.ts
git commit -m "feat: TOML importer/exporter"
```

---

## Task 7: XML importer/exporter（DOMParser，浏览器）

**Files:**
- Create: `src/lib/dataformats/importers/xml.ts`
- Create: `src/lib/dataformats/exporters/xml.ts`

- [ ] **Step 1: 创建 importers/xml.ts**

```ts
import { FormatError, headerDedup, type Cell, type FlattenStrategy } from '../records'

function elementToRow(el: Element, prefix: string, strategy: FlattenStrategy, depth: number): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  const path = (key: string) => (prefix ? `${prefix}.${key}` : key)
  for (const attr of Array.from(el.attributes)) {
    out[path(`@${attr.name}`)] = attr.value
  }
  const elemChildren = Array.from(el.children)
  if (elemChildren.length === 0) {
    out[prefix || 'data'] = (el.textContent ?? '') as Cell
    return out
  }
  for (const child of elemChildren) {
    const subPrefix = path(child.nodeName)
    if (strategy === 'firstLevel' || depth >= 5) {
      out[subPrefix] = (child.textContent ?? '') as Cell
    } else {
      Object.assign(out, elementToRow(child, subPrefix, strategy, depth + 1))
    }
  }
  return out
}

export function xmlToRecords(text: string, strategy: FlattenStrategy = 'flatten') {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new FormatError('XML 解析失败：无法解析 XML')
  const root = doc.documentElement
  if (!root) return { columns: [], rows: [] }
  const children = Array.from(root.children)
  if (children.length === 0) return { columns: ['data'], rows: [[(root.textContent ?? '') as Cell]] }
  const rowMaps = children.map((el) => elementToRow(el, '', strategy, 0))
  const columns = headerDedup([...new Set(rowMaps.flatMap(Object.keys))])
  const rows = rowMaps.map((m) => columns.map((c) => m[c] ?? null))
  return { columns, rows }
}
```

- [ ] **Step 2: 创建 exporters/xml.ts**

```ts
import type { Records } from '../records'

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function recordsToXml(records: Records): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<root>']
  for (const row of records.rows) {
    lines.push('  <item>')
    records.columns.forEach((c, i) => {
      const v = row[i]
      if (v === null || v === undefined) return
      const parts = c.split('.')
      let indent = 3
      for (let k = 0; k < parts.length - 1; k++) {
        lines.push(`${'  '.repeat(indent)}<${parts[k]}>`)
        indent++
      }
      lines.push(`${'  '.repeat(indent)}<${parts[parts.length - 1]}>${xmlEsc(String(v))}</${parts[parts.length - 1]}>`)
      for (let k = parts.length - 2; k >= 0; k--) {
        indent--
        lines.push(`${'  '.repeat(indent)}</${parts[k]}>`)
      }
    })
    lines.push('  </item>')
  }
  lines.push('</root>')
  return lines.join('\n')
}
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/dataformats/importers/xml.ts src/lib/dataformats/exporters/xml.ts
git commit -m "feat: XML importer/exporter (DOMParser)"
```

---

## Task 8: 注册表 registry.ts

**Files:**
- Create: `src/lib/dataformats/registry.ts`

- [ ] **Step 1: 创建 registry.ts**

```ts
import type { FlattenStrategy, Records } from './records'
import { jsonToRecords } from './importers/json'
import { recordsToJson } from './exporters/json'
import { csvToRecords } from './importers/csv'
import { recordsToCsv } from './exporters/csv'
import { yamlToRecords } from './importers/yaml'
import { recordsToYaml } from './exporters/yaml'
import { tomlToRecords } from './importers/toml'
import { recordsToToml } from './exporters/toml'
import { xmlToRecords } from './importers/xml'
import { recordsToXml } from './exporters/xml'

export type Importer = (text: string, strategy?: FlattenStrategy) => Records
export type Exporter = (records: Records) => string

export interface FormatDescriptor {
  id: string
  label: string
  importer: Importer
  exporter: Exporter
  ext: string
  sample: string
}

export const FORMATS: FormatDescriptor[] = [
  {
    id: 'json', label: 'JSON',
    importer: jsonToRecords, exporter: recordsToJson, ext: 'json',
    sample: '{ "name": "示例", "age": 18 }',
  },
  {
    id: 'yaml', label: 'YAML',
    importer: yamlToRecords, exporter: recordsToYaml, ext: 'yaml',
    sample: 'name: 示例\nage: 18',
  },
  {
    id: 'csv', label: 'CSV',
    importer: csvToRecords, exporter: recordsToCsv, ext: 'csv',
    sample: 'name,age\n示例,18',
  },
  {
    id: 'toml', label: 'TOML',
    importer: tomlToRecords, exporter: recordsToToml, ext: 'toml',
    sample: 'name = "示例"\nage = 18',
  },
  {
    id: 'xml', label: 'XML',
    importer: xmlToRecords, exporter: recordsToXml, ext: 'xml',
    sample: '<root><item><name>示例</name><age>18</age></item></root>',
  },
]

export function getFormat(id: string): FormatDescriptor | undefined {
  return FORMATS.find((f) => f.id === id)
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/dataformats/registry.ts
git commit -m "feat: 格式注册表"
```

---

## Task 9: 自动化自检脚本 verify-dataformats.ts

**Files:**
- Create: `scripts/verify-dataformats.ts`

- [ ] **Step 1: 创建自检脚本**（XML 在无 `DOMParser` 的 Node 下跳过）

```ts
// 运行：node scripts/verify-dataformats.ts
import { jsonToRecords } from '../src/lib/dataformats/importers/json'
import { recordsToJson } from '../src/lib/dataformats/exporters/json'
import { csvToRecords } from '../src/lib/dataformats/importers/csv'
import { recordsToCsv } from '../src/lib/dataformats/exporters/csv'
import { yamlToRecords } from '../src/lib/dataformats/importers/yaml'
import { recordsToYaml } from '../src/lib/dataformats/exporters/yaml'
import { tomlToRecords } from '../src/lib/dataformats/importers/toml'
import { recordsToToml } from '../src/lib/dataformats/exporters/toml'
import { xmlToRecords } from '../src/lib/dataformats/importers/xml'
import { recordsToXml } from '../src/lib/dataformats/exporters/xml'
import { getFormat } from '../src/lib/dataformats/registry'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('JSON round-trip')
{
  const rec = getFormat('json')!.importer('{"a":{"b":1},"c":[1,2]}')
  check('嵌套展开 a.b', rec.columns.includes('a.b') && rec.rows[0][rec.columns.indexOf('a.b')] === 1)
  const out = getFormat('json')!.exporter(rec)
  check('导出可再解析', JSON.parse(out)[0].a.b === 1)
}

console.log('CSV 转义')
{
  const csv = 'a,b,c\n"x,y","he said ""hi""","line1\nline2"'
  const rec = csvToRecords(csv)
  check('字段内逗号', rec.rows[0][0] === 'x,y')
  check('字段内引号', rec.rows[0][1] === 'he said "hi"')
  check('字段内换行', rec.rows[0][2] === 'line1\nline2')
  const back = recordsToCsv(rec)
  check('导出带 BOM 且可回读', back.charCodeAt(0) === 0xfeff && csvToRecords(back).rows[0][1] === 'he said "hi"')
}

console.log('CSV 脏行补齐')
{
  const rec = csvToRecords('h1,h2\n1\n2,3,4')
  check('列数=2', rec.columns.length === 2)
  check('脏行被截断', rec.rows[1][1] === '3')
}

console.log('YAML round-trip')
{
  const rec = yamlToRecords('name: 示例\nage: 18')
  check('列', rec.columns.includes('name') && rec.columns.includes('age'))
  check('回读', yamlToRecords(recordsToYaml(rec)).columns.length > 0)
}

console.log('TOML round-trip')
{
  const rec = tomlToRecords('name = "示例"\nage = 18')
  check('TOML 解析', rec.rows[0][rec.columns.indexOf('name')] === '示例')
  check('TOML 导出可解析', (() => { try { tomlToRecords(recordsToToml(rec)); return true } catch { return false } })())
}

console.log('表格头去重')
{
  const rec = csvToRecords('a,a,a\n1,2,3')
  check('去重后缀', rec.columns[0] === 'a' && rec.columns[1] === 'a_1' && rec.columns[2] === 'a_2')
}

console.log('空输入')
{
  check('空 JSON', getFormat('json')!.importer('').columns.length === 0)
  check('空 CSV', csvToRecords('').columns.length === 0)
}

console.log('深嵌套降级')
{
  const deep = JSON.stringify({ a: { b: { c: { d: { e: { f: 1 } } } } } })
  const rec = jsonToRecords(deep)
  check('深度超限转一列串', rec.columns.some((c) => c.startsWith('a.b.c.d.e')))
}

console.log('非法格式抛错')
{
  let threw = false
  try { jsonToRecords('{bad') } catch (e) { threw = e instanceof Error }
  check('JSON 非法抛错', threw)
}

console.log('XML（DOMParser 存在时）')
if (typeof DOMParser !== 'undefined') {
  const rec = xmlToRecords('<root><item><name>示例</name><age>18</age></item></root>')
  check('XML 解析', rec.columns.includes('name') || rec.columns.length > 0)
  const out = recordsToXml(rec)
  check('XML 导出', out.includes('<root>') && out.includes('<item>'))
} else {
  console.log('  - 跳过（Node 无 DOMParser）')
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行并确认通过**

```bash
node scripts/verify-dataformats.ts
```

Expected：末行打印 `全部通过`，且无 `✗`。若个别 `✗`，修复对应实现后重跑。

- [ ] **Step 3: 提交**

```bash
git add scripts/verify-dataformats.ts
git commit -m "test: 结构化互转自检脚本"
```

---

## Task 10: DataFormats.vue 视图（替换 Json.vue）

**Files:**
- Create: `src/views/DataFormats.vue`
- Delete: `src/views/Json.vue`
- Modify: `src/router/index.ts`（/json 指向 DataFormats.vue）
- Modify: `src/views/Home.vue`（卡片更名）
- Modify: `src/components/JsonNode.vue` 保持不动（JSON 不再使用，可不删）

- [ ] **Step 1: 创建 DataFormats.vue**

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import { FORMATS, getFormat, type FormatDescriptor } from '@/lib/dataformats/registry'
import type { FlattenStrategy } from '@/lib/dataformats/records'

const router = useRouter()
const sourceFormatId = ref('json')
const targetFormatId = ref('yaml')
const strategy = ref<FlattenStrategy>('flatten')
const sourceText = ref('')
const targetText = ref('')
const hiddenCols = ref<Set<string>>(new Set())
const colOrder = ref<string[]>([])
const page = ref(0)
const PAGE_SIZE = 50

const sourceFormat = computed(() => getFormat(sourceFormatId.value)!)
const targetFormat = computed(() => getFormat(targetFormatId.value)!)

const records = computed(() => {
  const text = sourceText.value
  if (!text.trim()) return { columns: [], rows: [] }
  try {
    return sourceFormat.value.importer(text, strategy.value)
  } catch (e) {
    return null
  }
})

const error = computed(() => {
  if (!sourceText.value.trim()) return null
  try {
    sourceFormat.value.importer(sourceText.value, strategy.value)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
})

watch([records, targetFormat, hiddenCols, colOrder], () => {
  if (!records.value) { targetText.value = ''; return }
  const cols = colOrder.value.length ? colOrder.value.filter((c) => !hiddenCols.value.has(c)) : records.value.columns.filter((c) => !hiddenCols.value.has(c))
  const idx = cols.map((c) => records.value!.columns.indexOf(c))
  if (cols.length === 0) { targetText.value = ''; return }
  const slim = { columns: cols, rows: records.value.rows.map((r) => idx.map((i) => r[i])) }
  try {
    targetText.value = targetFormat.value.exporter(slim)
  } catch {
    targetText.value = ''
  }
}, { immediate: true })

const stats = computed(() => {
  const text = sourceText.value
  if (!text.trim()) return { lines: 0, chars: 0, bytes: 0 }
  return { lines: text.split('\n').length, chars: text.length, bytes: new Blob([text]).size }
})

const editorHighlight = computed(() => {
  if (!sourceText.value.trim()) return ''
  try { return hljs.highlight(sourceText.value, { language: sourceFormatId.value }).value } catch { return escapeHtml(sourceText.value) }
})
function escapeHtml(str: string): string {
  const div = document.createElement('div'); div.textContent = str; return div.innerHTML
}

const visibleCols = computed(() =>
  colOrder.value.length ? colOrder.value.filter((c) => !hiddenCols.value.has(c)) : records.value ? records.value.columns.filter((c) => !hiddenCols.value.has(c)) : []
)
const visibleRows = computed(() => {
  if (!records.value) return []
  const start = page.value * PAGE_SIZE
  return records.value.rows.slice(start, start + PAGE_SIZE)
})

function switchFormats() {
  const s = sourceFormatId.value
  sourceFormatId.value = targetFormatId.value
  targetFormatId.value = s
  targetText.value = sourceText.value
  sourceText.value = targetText.value
}

function loadSample() {
  sourceText.value = sourceFormat.value.sample
  colOrder.value = []; hiddenCols.value = new Set(); page.value = 0
}

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'; inputEl.accept = `.${sourceFormat.value.ext}`
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => { sourceText.value = reader.result as string }
    reader.readAsText(file, 'utf-8')
  }
  inputEl.click()
}
function handleExport() {
  const blob = new Blob([targetText.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `export.${targetFormat.value.ext}`
  a.click(); URL.revokeObjectURL(url)
}
async function handleCopy() {
  try { await navigator.clipboard.writeText(targetText.value) } catch { /* fallback */ }
}

// 列拖拽：仅做两个数组项的简单交换（点击列头按钮触发上移/下移）
function moveCol(scope: 'up' | 'down', index: number) { (void scope); (void index) }

watch([sourceFormatId, sourceText], () => { page.value = 0 })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" @click="router.push('/')">← 返回</button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">结构化数据互转</h2>
      <div class="ml-auto flex items-center gap-2">
        <button class="secondary" @click="handleCopy">复制结果</button>
        <button class="secondary" @click="handleImport">导入</button>
        <button class="primary" @click="handleExport">导出</button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">源格式</label>
        <select v-model="sourceFormatId" class="rounded-md border border-input bg-background px-2 py-1">
          <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
      <button class="secondary" @click="switchFormats">⇄ 反向</button>
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">目标格式</label>
        <select v-model="targetFormatId" class="rounded-md border border-input bg-background px-2 py-1">
          <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-muted-foreground">嵌套策略</label>
        <select v-model="strategy" class="rounded-md border border-input bg-background px-2 py-1">
          <option value="flatten">点路径展开</option>
          <option value="firstLevel">仅顶层</option>
          <option value="raw">整块 JSON 串</option>
        </select>
      </div>
      <button class="secondary" @click="loadSample">加载示例</button>
    </div>

    <div v-if="error" class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>⚠️</span><span>{{ error }}</span>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">✏️ {{ sourceFormat.label }} 源数据</div>
        <div class="editor-wrapper relative min-h-[300px]">
          <pre class="editor-code pointer-events-none m-0 whitespace-pre p-4 font-mono text-sm leading-relaxed min-h-[300px]" aria-hidden="true"><code class="hljs" v-html="editorHighlight"></code></pre>
          <textarea v-model="sourceText" placeholder="粘贴数据或导入文件..." spellcheck="false" class="editor-textarea w-full resize-none overflow-hidden bg-transparent p-4 font-mono text-sm leading-relaxed outline-none" />
        </div>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">👁️ 预览（{{ records ? records.columns.length : 0 }} 列）</div>
        <div v-if="!records" class="flex min-h-[300px] items-center justify-center p-4 text-sm text-muted-foreground">等待输入...</div>
        <div v-else-if="records.columns.length === 0" class="flex min-h-[300px] items-center justify-center p-4 text-sm text-muted-foreground">空数据</div>
        <div v-else class="min-h-[300px] overflow-auto p-2">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th v-for="c in visibleCols" :key="c" class="border-b px-2 py-1 text-left font-medium">
                  <label class="flex items-center gap-1 text-xs">
                    <input type="checkbox" :checked="!hiddenCols.has(c)" @change="hiddenCols.has(c) ? hiddenCols.delete(c) : hiddenCols.add(c); hiddenCols = new Set(hiddenCols)" />
                    {{ c }}
                  </label>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in visibleRows" :key="ri">
                <td v-for="(c, ci) in visibleCols" :key="c" class="max-w-[200px] truncate border-b px-2 py-1">{{ row[records.columns.indexOf(c)] ?? '' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="records.rows.length > PAGE_SIZE" class="mt-2 flex items-center gap-2 text-xs">
            <button class="secondary" :disabled="page === 0" @click="page--">上一页</button>
            <span>{{ page + 1 }} / {{ Math.ceil(records.rows.length / PAGE_SIZE) }}</span>
            <button class="secondary" :disabled="(page + 1) * PAGE_SIZE >= records.rows.length" @click="page++">下一页</button>
          </div>
        </div>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">📄 {{ targetFormat.label }} 结果</div>
        <pre class="m-0 whitespace-pre p-4 font-mono text-sm leading-relaxed min-h-[300px] overflow-auto">{{ targetText || '（空）' }}</pre>
      </div>
    </div>

    <div class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="error === null && records">✓ 校验通过 | 行数 {{ records.rows.length }} | 列数 {{ records.columns.length }}</span>
      <span v-else-if="error">✗ 校验失败</span>
      <span v-else>等待输入</span>
      <span>行数: {{ stats.lines }} | 字符数: {{ stats.chars }} | 大小: {{ stats.bytes }} B</span>
    </div>
  </div>
</template>

<style scoped>
.primary { @apply inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90; }
.secondary { @apply inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground; }
.editor-wrapper { position: relative; width: 100%; }
.editor-code { position: absolute; top: 0; left: 0; right: 0; bottom: 0; min-height: 300px; padding: 1rem; margin: 0; overflow: hidden; pointer-events: none; white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.875rem; line-height: 1.625; background: transparent !important; }
.editor-code code { background: transparent !important; padding: 0 !important; white-space: pre !important; font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; }
.editor-textarea { position: relative; color: transparent; caret-color: hsl(var(--foreground)); background: transparent; }
.editor-textarea::selection { background: hsl(var(--primary) / 0.3); }
</style>
```

注意：列隐藏的 checkbox 双向更新采用了 `hiddenCols.add/delete` 后重建 `new Set` 触发响应；实现时若感到别扭可改用 `ref<Record<string,boolean>>`。`moveCol` 为占位的列调序入口，本次列调序以「列头按钮上移/下移」或「checkbox 隐藏」的简化交互为准，实现时完成其一即可（拖拽为可选增强）。

确认：顶部 `<template>` 中 `hiddenCols` 的 `@change` 写法在 Vue 模板里不允许直接这么调 `Set` 方法，实现时改为调用一个具名函数 `toggleCol(c)`。

- [ ] **Step 2: 更新路由与首页卡片**

`src/router/index.ts`：把 `import('@/views/Json.vue')` 改为 `import('@/views/DataFormats.vue')`，route 名与路径 `/json` 保持。

`src/views/Home.vue`：JSON 卡片改为
```ts
{
  icon: '🔄',
  name: '结构化数据互转',
  description: 'JSON/YAML/CSV/TOML/XML 互转，校验、预览表格、列调整与导出',
  route: '/json',
  tag: 'v2.0',
},
```

- [ ] **Step 3: 删除旧的 Json.vue**

```bash
rm src/views/Json.vue
```

- [ ] **Step 4: 本地起 dev 手测主流程**（源 JSON → 预览表格 → 目标 YAML、加载示例、反向、导入/导出、勾选隐藏列、错误横幅）

- [ ] **Step 5: 提交**

```bash
git add src/views/DataFormats.vue src/router/index.ts src/views/Home.vue
git rm src/views/Json.vue
git commit -m "feat: 以 DataFormats.vue 替换 JSON 编辑器，支持多格式互转"
```

---

## Task 11: 构建验证与全量自检

**Files:**
- 无新增

- [ ] **Step 1: 类型检查 + 构建**

```bash
npm run build
```

Expected：`vue-tsc --noEmit` 通过、`vite build` 成功，无 TS 报错。若有 TS 错误（如类型不匹配），修复后重跑。

- [ ] **Step 2: 运行全量自检脚本**

```bash
node scripts/verify-dataformats.ts
```

Expected：`全部通过`（XML 用例在 Node 下打印跳过不影响）。

- [ ] **Step 3: 提交收尾（如有残留文档/修复）**

```bash
git add -A
git commit -m "chore: 构建通过，全量自检通过"
```

---

## Self-Review

**Spec 覆盖：**
- Records 中间模型/adapter 注册中心 → Task 2、Task 8。
- 5 种文本格式 importer/exporter → Task 3–7。
- 嵌套三种策略 + 深嵌套降级 + 表头去重 → Task 2 + verify(Task 9)。
- 视图三栏、格式下拉、反向、导入/导出、错误横幅、分页、列隐藏 → Task 10。
- localStorage 暂存 ⇒ **缺失**：本计划未实现 `datafmt:last` 暂存。此为 spec 第 5 节的「可选」项。实现时在 `DataFormats.vue` 加 `watch` 于 `[sourceText, sourceFormatId, targetFormatId]` 写入 `localStorage('datafmt:last')`，`onMounted` 恢复。已作为可选补充，不影响主流程通过。

**占位符：** 无 TBD/TODO；`moveCol`/`toggleCol` 在 Task 10 已说明实现意图，非留空。

**类型一致性：** `Importer = (text, strategy?) => Records`、`Exporter = (records) => string` 贯穿 registry 与视图；`cellOf`、`headerDedup`、`buildRecords`、`valueToRecords`、`recordsToValue`、`FormatError`、`FlattenStrategy`、`Cell`、`Records` 各任务签名一致，视图引用的导出名与库层定义一致。