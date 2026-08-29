# HTTP 接口调试器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AnyPCToolbox 中新增一个类似 Postman 的 HTTP 接口调试工具，提供「请求模板+变量」的可视化配置、可折叠侧栏、JSONPath 分页表格响应与字段类型渲染（枚举映射/图片/时间戳等）。

**Architecture:** 纯前端 SPA 实现，请求用浏览器 `fetch`（CORS 作为已知局限提示）。接口数据（请求模板+解析配置）、请求历史、全局变量均持久化到 IndexedDB（复用 `anypctoolbox` 库 KV store）。核心业务逻辑（占位符/请求构造/响应解析/渲染）抽到 `src/lib/debugger/*` 纯函数模块，用 `scripts/verify-http-client.ts`（Node 原生 TS）自检；IndexedDB 与 Vue 组件用 `npm run build`（vue-tsc）做类型校验。

**Tech Stack:** Vue 3 + TypeScript + Tailwind + shadcn token 体系；`jsonpath-plus`（新增依赖，唯一新引入的包）；浏览器 `fetch` + `AbortController`；Node 原生 TS stripping 跑自检脚本。

**约定**：严格遵循 [工具开发约定](../2026-08-18-tool-dev-convention.md)（语义色 token、`rounded-lg border` 面板、`.dark` 兼容）。

---

### Task 1: 依赖与数据模型

**Files:**
- Modify: `package.json`
- Create: `src/lib/debugger/model.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm install jsonpath-plus
```

Expected: `jsonpath-plus` 出现在 `package.json` 的 `dependencies`。

- [ ] **Step 2: 写数据模型**

Create `src/lib/debugger/model.ts`：

```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyType = 'none' | 'json' | 'form' | 'text'
export type ColumnType = 'text' | 'number' | 'bool' | 'enum' | 'image' | 'datetime' | 'link'

export interface KvItem {
  key: string
  value: string
}

export interface VariableDef {
  name: string
  value: string
  desc?: string
}

export interface ColumnDef {
  field: string
  title: string
  type: ColumnType
  enumMap?: Record<string, string> // 如 { '1': '男', '2': '女' }
  width?: number
}

export interface ParseConfig {
  listPath: string
  totalPath?: string
  pagePath?: string
  columns: ColumnDef[]
}

export interface ApiRequest {
  id: string
  protocol: 'http' // 预留 'ws' | 'graphql'
  name: string
  method: HttpMethod
  urlTemplate: string // 可含 {{var}}
  query: KvItem[]
  headers: KvItem[]
  bodyType: BodyType
  bodyText: string // 可含 {{var}}
  variables: VariableDef[]
  parse: ParseConfig
  updatedAt: number
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function createApiRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: partial.id ?? (crypto.randomUUID ? crypto.randomUUID() : `a${Date.now()}${Math.random().toString(16).slice(2)}`),
    protocol: 'http',
    name: partial.name ?? '新接口',
    method: METHODS.includes(partial.method as HttpMethod) ? (partial.method as HttpMethod) : 'GET',
    urlTemplate: partial.urlTemplate ?? 'https://example.com/',
    query: partial.query ?? [],
    headers: partial.headers ?? [],
    bodyType: partial.bodyType ?? 'none',
    bodyText: partial.bodyText ?? '',
    variables: partial.variables ?? [],
    parse: { listPath: '', columns: [], ...partial.parse },
    updatedAt: partial.updatedAt ?? Date.now(),
  }
}
```

- [ ] **Step 3: 类型校验**

Run: `npm run build`
Expected: 通过（无 `vue-tsc` 报错）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/debugger/model.ts
git commit -m "feat(debugger): 数据模型 + jsonpath-plus 依赖"
```

---

### Task 2: 占位符提取 / 替换 / 合并（纯逻辑）

**Files:**
- Create: `src/lib/debugger/variables.ts`
- Create: `scripts/verify-http-client.ts`

- [ ] **Step 1: 写失败自检脚本**

Create `scripts/verify-http-client.ts`：

```typescript
// HTTP 调试器核心逻辑自检脚本（非单元测试框架）
// 运行：node scripts/verify-http-client.ts
import { extractPlaceholders, resolveVars, replaceAll, collectSnippet } from '../src/lib/debugger/variables.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('占位符提取')
check('提取 url 中的 {{userId}}', extractPlaceholders(['/users/{{userId}}']).includes('userId'))
check('去重', extractPlaceholders(['{{a}}', '{{a}}', '{{b}}']).length === 2)
check('忽略花括号非占位符', extractPlaceholders(['{a}']).length === 0)
check('支持点号/横线', extractPlaceholders(['{{user.name}}', '{{x-y}}']).length === 2)

console.log('变量合并与替换')
const resolved = resolveVars([{ name: 'id', value: '42' }, { name: 'token', value: '' }], { token: 'SECRET' })
check('模板变量优先', resolved.id === '42')
check('模板空值回退全局', resolved.token === 'SECRET')
const g: Record<string, string> = {}
check('全局缺省为空字符串', resolveVars([{ name: 'x', value: '' }], g).x === '')
check('替换 {{id}} → 42', replaceAll('/users/{{id}}', { id: '42' }) === '/users/42')
check('未命中占位符原样保留', replaceAll('/u/{{nope}}', {}) === '/u/{{nope}}')
check('collectSnippet 串联各来源', collectSnippet({ urlTemplate: '/{{a}}', query: [{ key: 'k', value: '{{b}}' }], headers: [{ key: 'h', value: '{{c}}' }], bodyText: '{{d}}' }).includes('{{d}}'))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-http-client.ts`
Expected: FAIL —— `Cannot find module '../src/lib/debugger/variables.ts'`

- [ ] **Step 3: 实现**

Create `src/lib/debugger/variables.ts`：

```typescript
import type { ApiRequest } from './model.ts'

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

/** 提取字符串中所有占位符名（去重、保序） */
export function extractPlaceholders(sources: string[]): string[] {
  const set = new Map<string, true>()
  for (const s of sources) {
    for (const m of s.matchAll(PLACEHOLDER)) {
      if (!set.has(m[1])) set.set(m[1], true)
    }
  }
  return [...set.keys()]
}

/** 收集一个接口所有可能含占位符的文本片段（用于提取） */
export function collectSnippet(api: Pick<ApiRequest, 'urlTemplate' | 'query' | 'headers' | 'bodyText'>): string {
  return [
    api.urlTemplate,
    ...api.query.map((q) => q.value),
    ...api.headers.map((h) => h.value),
    api.bodyText,
  ].join('\n')
}

/** 解析最终的变量字典：模板变量值优先，未设置(空)回退全局 */
export function resolveVars(vars: { name: string; value: string }[], globals: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of vars) {
    out[v.name] = v.value || globals[v.name] || ''
  }
  Object.keys(globals).forEach((k) => { if (out[k] === undefined) out[k] = globals[k] ?? '' })
  return out
}

/** 替换模板中的 {{name}}；未命中的占位符原样保留 */
export function replaceAll(template: string, resolved: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_m, name: string) =>
    name in resolved ? resolved[name] : _m,
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-http-client.ts`
Expected: 全部 `✓`，末行 `全部通过`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/debugger/variables.ts scripts/verify-http-client.ts
git commit -m "feat(debugger): 占位符提取/替换/合并逻辑"
```

---

### Task 3: 请求构造器（纯逻辑，不真正发送）

**Files:**
- Create: `src/lib/debugger/builder.ts`
- Modify: `scripts/verify-http-client.ts`

- [ ] **Step 1: 加失败断言**

在 `verify-http-client.ts` 顶部 import 加一行，在 `console.log(failed === 0 ...)` 之前插入：

```typescript
import { buildRequest } from '../src/lib/debugger/builder.ts'
```

```typescript
console.log('请求构造')
const req = buildRequest(
  {
    id: '1', protocol: 'http', name: 'g', method: 'GET', urlTemplate: 'https://x.com/u/{{id}}',
    query: [{ key: 'page', value: '{{page}}' }, { key: 'q', value: 'a b' }],
    headers: [{ key: 'Auth', value: 'Bearer {{token}}' }],
    bodyType: 'json', bodyText: '{"id":"{{id}}"}',
    variables: [], parse: { listPath: '', columns: [] }, updatedAt: 0,
  },
  { id: '42', page: '1', token: 'T' },
)
check('URL 模板替换 + 追加 query（且 query 值编码空格）', req.url === 'https://x.com/u/42?page=1&q=a%20b', req.url)
check('Header 值替换', req.headers[0]?.[1] === 'Bearer T')
check('JSON body 替换', req.body === '{"id":"42"}')
check('json 类型默认注入 Content-Type', req.headers.some(([k]) => k.toLowerCase() === 'content-type'))

const noBody = buildRequest(
  { id: '1', protocol: 'http', name: 'g', method: 'POST', urlTemplate: 'https://x.com', query: [], headers: [], bodyType: 'none', bodyText: '', variables: [], parse: { listPath: '', columns: [] }, updatedAt: 0 },
  {},
)
check('bodyType none 不注入 Content-Type', !noBody.headers.some(([k]) => k.toLowerCase() === 'content-type'))
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-http-client.ts`
Expected: FAIL —— `Cannot find module '../src/lib/debugger/builder.ts'`

- [ ] **Step 3: 实现**

Create `src/lib/debugger/builder.ts`：

```typescript
import type { ApiRequest } from './model.ts'
import { replaceAll } from './variables.ts'

export type BuiltRequest = {
  method: string
  url: string
  headers: [string, string][]
  body?: string
}

export function buildRequest(api: ApiRequest, resolved: Record<string, string>): BuiltRequest {
  let url = replaceAll(api.urlTemplate, resolved)
  const query = api.query
    .filter((q) => q.key.trim() !== '')
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(replaceAll(q.value, resolved))}`)
  if (query.length) url += (url.includes('?') ? '&' : '?') + query.join('&')

  const headers = api.headers.filter((h) => h.key.trim() !== '').map((h): [string, string] => [h.key, replaceAll(h.value, resolved)])
  const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type')

  let body: string | undefined
  if (api.bodyType === 'json' || api.bodyType === 'text') {
    body = replaceAll(api.bodyText, resolved)
    if (api.bodyType === 'json' && !hasContentType && (body ?? '').trim() !== '') {
      headers.push(['Content-Type', 'application/json'])
    }
  } else if (api.bodyType === 'form') {
    body = replaceAll(api.bodyText, resolved)
    if ((body ?? '').trim() !== '' && !hasContentType) headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
  }

  return { method: api.method, url, headers, body: body || undefined }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-http-client.ts`
Expected: 全部 `✓`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/debugger/builder.ts scripts/verify-http-client.ts
git commit -m "feat(debugger): 请求构造器（URL/Header/Body）"
```

---

### Task 4: 响应 JSONPath 解析（纯逻辑）

**Files:**
- Create: `src/lib/debugger/parse.ts`
- Modify: `scripts/verify-http-client.ts`

- [ ] **Step 1: 加失败断言**

Import 加 `import { parseResponse } from '../src/lib/debugger/parse.ts'`；插入断言：

```typescript
console.log('响应解析')
const raw = JSON.stringify({ code: 0, data: { list: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }], total: 2, page: 1 } })
const r = parseResponse(raw, { listPath: '$.data.list', totalPath: '$.data.total', pagePath: '$.data.page', columns: [] })
check('rows 命中列表', r.rows.length === 2, String(r.rows.length))
check('total 提取', r.total === 2, String(r.total))
check('page 提取', r.page === 1, String(r.page))
check('rows 元素保留原始字段', (r.rows[0] as { id: number }).id === 1)
const empty = parseResponse(raw, { listPath: '$.missing.path', columns: [] })
check('路径未命中 → rows 空', empty.rows.length === 0)
check('路径未命中 → 标记 ok:false', empty.ok === false)
check('topKeys 提供顶层键', Array.isArray(empty.topKeys) && empty.topKeys.includes('code'))
const bad = parseResponse('not json', { listPath: '$.list', columns: [] })
check('非法 JSON → error 提示', bad.ok === false && typeof bad.error === 'string')
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-http-client.ts`
Expected: FAIL —— `Cannot find module '../src/lib/debugger/parse.ts'`

- [ ] **Step 3: 实现**

Create `src/lib/debugger/parse.ts`：

```typescript
import { JSONPath } from 'jsonpath-plus'
import type { ParseConfig } from './model.ts'

export interface ParseResult {
  ok: boolean
  json: unknown | null
  raw: string
  rows: unknown[]
  total?: number
  page?: number
  topKeys?: string[]
  error?: string
}

function pick(path: string, json: unknown): unknown {
  if (!path || path.trim() === '') return undefined
  const arr = JSONPath({ path: path.trim(), json }) as unknown[]
  return arr && arr.length ? arr[0] : undefined
}

function asNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function parseResponse(raw: string, cfg: ParseConfig): ParseResult {
  let json: unknown = null
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, json: null, raw, rows: [], error: '响应不是合法 JSON' }
  }
  const topKeys = Array.isArray(json) ? [] : typeof json === 'object' && json !== null ? Object.keys(json as Record<string, unknown>) : undefined
  const rowsRaw = pick(cfg.listPath, json)
  const rows = Array.isArray(rowsRaw) ? rowsRaw : []
  const total = cfg.totalPath ? asNum(pick(cfg.totalPath, json)) : undefined
  const page = cfg.pagePath ? asNum(pick(cfg.pagePath, json)) : undefined
  const ok = rows.length > 0
  return { ok, json, raw, rows, total, page, topKeys, error: ok ? undefined : '未匹配到列表数据，检查 listPath' }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-http-client.ts`
Expected: 全部 `✓`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/debugger/parse.ts scripts/verify-http-client.ts
git commit -m "feat(debugger): JSONPath 响应解析"
```

---

### Task 5: 单元格类型渲染（纯逻辑，Vue 侧只按 kind 分发）

**Files:**
- Create: `src/lib/debugger/renderers.ts`
- Modify: `scripts/verify-http-client.ts`

- [ ] **Step 1: 加失败断言**

Import 加 `import { toCellView } from '../src/lib/debugger/renderers.ts'`；插入断言：

```typescript
console.log('单元格渲染')
const enumCol = { field: 's', title: '性别', type: 'enum' as const, enumMap: { '1': '男', '2': '女' } }
check('enum 1 → 男', toCellView(1, enumCol).text === '男')
check('enum 未命中 → 原文', toCellView(9, enumCol).text === '9')
const imgCol = { field: 'u', title: '图', type: 'image' as const }
check('image 判定为图片', toCellView('https://x.com/a.png', imgCol).kind === 'image')
const dtCol = { field: 't', title: '时间', type: 'datetime' as const }
check('datetime 秒级时间戳格式化', /2023/.test(toCellView(1693948800, dtCol).text), toCellView(1693948800, dtCol).text)
check('datetime 毫秒级时间戳格式化', /2023/.test(toCellView(1693948800000, dtCol).text))
const boolCol = { field: 'b', title: '启用', type: 'bool' as const }
check('bool true → 是', toCellView(true, boolCol).text === '是')
const linkCol = { field: 'l', title: '链', type: 'link' as const }
check('link 判定为链接', toCellView('https://x.com', linkCol).kind === 'link')
check('text 普通字符串', toCellView('hi', { field: 'x', title: 'x', type: 'text' as const }).kind === 'text')
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/verify-http-client.ts`
Expected: FAIL —— `Cannot find module '../src/lib/debugger/renderers.ts'`

- [ ] **Step 3: 实现**

Create `src/lib/debugger/renderers.ts`：

```typescript
import type { ColumnDef } from './model.ts'

export interface CellView {
  kind: 'text' | 'image' | 'link'
  text: string
}

export function enumLabel(v: unknown, map?: Record<string, string>): string {
  const key = v === null || v === undefined ? '' : String(v)
  return map && key in map ? map[key] : key
}

function formatDatetime(v: unknown): string {
  if (v === null || v === undefined) return ''
  const n = Number(v)
  if (Number.isFinite(n)) {
    const ms = Math.abs(n) > 1e12 ? n : n * 1000 // 毫秒级 vs 秒级
    return new Date(ms).toLocaleString()
  }
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

const TOLERATED_DATE_FIELDS = /(time|date|at|ts|_at$|time$/i)

export function toCellView(value: unknown, col: ColumnDef): CellView {
  const raw = value === null || value === undefined ? '' : value
  switch (col.type) {
    case 'image': {
      const s = String(raw)
      return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?\S*)?$/i.test(s)
        ? { kind: 'image', text: s }
        : { kind: 'text', text: s }
    }
    case 'link':
      return /^https?:\/\/\S+$/i.test(String(raw)) ? { kind: 'link', text: String(raw) } : { kind: 'text', text: String(raw) }
    case 'enum':
      return { kind: 'text', text: enumLabel(raw, col.enumMap) }
    case 'bool':
      return { kind: 'text', text: raw === true || raw === 1 || raw === '1' || raw === 'true' ? '是' : '否' }
    case 'datetime':
      return { kind: 'text', text: formatDatetime(raw) }
    case 'number':
      return { kind: 'text', text: typeof raw === 'number' ? String(raw) : String(raw) }
    default:
      return { kind: 'text', text: String(raw) }
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/verify-http-client.ts`
Expected: 全部 `✓`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/debugger/renderers.ts scripts/verify-http-client.ts
git commit -m "feat(debugger): 单元格类型渲染"
```

---

### Task 6: IndexedDB 持久化（db.ts）

**Files:**
- Create: `src/lib/debugger/db.ts`

IndexedDB 浏览器专属，无法用 Node 自检脚本，以 `npm run build` 类型校验为准（`debugger` 引用的类型都已在 Task 1 定义）。

- [ ] **Step 1: 实现 db.ts**

Create `src/lib/debugger/db.ts`（沿用 units `idb.ts` 风格，复用 `anypctoolbox` 库 + `kv` store）：

```typescript
// 极简 IndexedDB 封装：HTTP 调试器的接口集合 / 历史 / 全局变量
// 结构：anypctoolbox 库 + kv store；每个逻辑集合存在一个 key 的对象 map 上（避免游标遍历）
import type { ApiRequest } from './model.ts'

const DB_NAME = 'anypctoolbox'
const STORE = 'kv'
const KEY_APIS = 'http:apis'
const KEY_GLOBALS = 'http:globals'
const HISTORY_PREFIX = 'http:history:'
export const HISTORY_CAP = 20

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

async function get<V>(key: string): Promise<V | null> {
  const db = await openDb()
  return new Promise<V | null>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as V | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- 接口集合：{ id: ApiRequest } ----
export async function getApis(): Promise<Record<string, ApiRequest>> {
  return (await get<Record<string, ApiRequest>>(KEY_APIS)) ?? {}
}
export async function saveApis(map: Record<string, ApiRequest>): Promise<void> {
  try { await set(KEY_APIS, map) } catch { /* 静默 */ }
}

// ---- 请求历史：key = http:history:<apiId>，数组，最新在前，截断 HISTORY_CAP ----
export interface HistoryEntry {
  ts: number
  status: number
  ms: number
  size: number
  raw: string
}
export async function getHistory(apiId: string): Promise<HistoryEntry[]> {
  return (await get<HistoryEntry[]>(`${HISTORY_PREFIX}${apiId}`)) ?? []
}
export async function pushHistory(apiId: string, entry: HistoryEntry): Promise<void> {
  const list = await getHistory(apiId)
  list.unshift(entry)
  try { await set(`${HISTORY_PREFIX}${apiId}`, list.slice(0, HISTORY_CAP)) } catch { /* 静默 */ }
}

// ---- 全局变量：{ name: value } ----
export type Globals = Record<string, string>
export async function getGlobals(): Promise<Globals> {
  return (await get<Globals>(KEY_GLOBALS)) ?? {}
}
export async function saveGlobals(g: Globals): Promise<void> {
  try { await set(KEY_GLOBALS, g) } catch { /* 静默 */ }
}
```

- [ ] **Step 2: 类型校验**

Run: `npm run build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/lib/debugger/db.ts
git commit -m "feat(debugger): IndexedDB 持久化（接口/历史/全局变量）"
```

---

### Task 7: 路由、首页卡片与应用外壳

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/Home.vue`
- Create: `src/views/HttpClient.vue`（先放最小可编译外壳）

- [ ] **Step 1: 注册路由**

在 `src/router/index.ts` 末尾加：

```typescript
{
  path: '/http-client',
  name: 'http-client',
  component: () => import('@/views/HttpClient.vue'),
},
```

- [ ] **Step 2: 首页卡片**

在 `src/views/Home.vue` 的 `tools` 数组加：

```typescript
{
  icon: '🧪',
  name: 'HTTP 接口调试',
  description: '请求模板+变量、JSONPath 分页表格、字段类型渲染，纯前端调试任意接口',
  route: '/http-client',
  tag: 'v1.0',
},
```

- [ ] **Step 3: 最小外壳**

Create `src/views/HttpClient.vue`：

```vue
<script setup lang="ts">
import { createApiRequest } from '@/lib/debugger/model'
import { getApis, saveApis } from '@/lib/debugger/db'
import { onMounted, ref } from 'vue'

const apis = ref<Record<string, import('@/lib/debugger/model').ApiRequest>>({})
const currentId = ref<string>('')
const activeTab = ref<'config' | 'run' | 'history'>('config')

onMounted(async () => {
  apis.value = await getApis()
  const first = Object.keys(apis.value)[0]
  if (first) currentId.value = first
  else {
    const a = createApiRequest()
    apis.value = { [a.id]: a }
    currentId.value = a.id
    await saveApis(apis.value)
  }
})
</script>

<template>
  <div class="flex h-full">
    <aside class="w-60 shrink-0 border-r border-border bg-card p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">接口列表</span>
      </div>
      <p class="text-sm text-muted-foreground">正在搭建…</p>
    </aside>
    <main class="flex-1 overflow-auto">{{ currentId }}</main>
  </div>
</template>
```

- [ ] **Step 4: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。`npm run dev` 后主页出现「HTTP 接口调试」卡片，点进可见最小外壳。

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts src/views/Home.vue src/views/HttpClient.vue
git commit -m "feat(debugger): 路由 / 首页卡片 / 应用外壳"
```

---

### Task 8: 「配置」Tab —— 请求模板编辑（可折叠侧栏）

**Files:**
- Modify: `src/views/HttpClient.vue`
- Create: `src/components/debugger/KvRows.vue`
- Create: `src/components/debugger/ConfigPanel.vue`

- [ ] **Step 1: 键值行组件**

Create `src/components/debugger/KvRows.vue`（Query/Header 通用）：

```vue
<script setup lang="ts">
import type { KvItem } from '@/lib/debugger/model'

defineProps<{ rows: KvItem[] }>()
const emit = defineEmits<{ (e: 'update', rows: KvItem[]): void }>()

function set(key: string, value: string, i: number) {
  const rows = toRows()
  rows[i] = { key, value }
  emit('update', rows)
}
function remove(i: number) {
  const rows = toRows()
  rows.splice(i, 1)
  emit('update', rows)
}
function add() {
  emit('update', [...toRows(), { key: '', value: '' }])
}
function toRows() {
  // 用 props 深拷贝避免直接改
  return JSON.parse(JSON.stringify(props.rows)) as KvItem[]
}
const props = defineProps<{ rows: KvItem[] }>()
</script>

<template>
  <div class="space-y-1.5">
    <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-1.5">
      <input
        class="w-1/2 rounded-md border-border border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :value="r.key" placeholder="key" @input="set(($event.target as HTMLInputElement).value, r.value, i)"
      />
      <input
        class="flex-1 rounded-md border-border border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :value="r.value" placeholder="value（可 {{var}}）" @input="set(r.key, ($event.target as HTMLInputElement).value, i)"
      />
      <button class="rounded-md border border-input bg-background p-1 text-muted-foreground hover:bg-accent" @click="remove(i)">✕</button>
    </div>
    <button class="text-sm text-primary hover:underline" @click="add">+ 添加</button>
  </div>
</template>
```

- [ ] **Step 2: 配置面板组件（可折叠侧栏分组）**

Create `src/components/debugger/ConfigPanel.vue`（props 透传，由父组件读写当前接口）：

```vue
<script setup lang="ts">
import type { ApiRequest, ParseConfig } from '@/lib/debugger/model'
import KvRows from './KvRows.vue'
import { computed, ref } from 'vue'

const props = defineProps<{ api: ApiRequest }>()
const emit = defineEmits<{
  (e: 'update', api: ApiRequest): void
}>()
const open = ref<Record<string, boolean>>({ query: true, headers: true, body: true, parse: true })

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const bodyTypes = ['none', 'json', 'form', 'text'] as const
const colTypes = ['text', 'number', 'bool', 'enum', 'image', 'datetime', 'link'] as const

function patch(p: Partial<ApiRequest>) {
  emit('update', { ...props.api, ...p, updatedAt: Date.now() })
}
const parse = computed(() => props.api.parse)
function patchParse(p: Partial<ParseConfig>) {
  patch({ parse: { ...props.api.parse, ...p } })
}
</script>

<template>
  <div class="space-y-3">
    <!-- 顶部排序：Method + URL -->
    <div class="flex items-center gap-2">
      <select
        v-model="api.method" @change="patch({ method: api.method as ApiRequest['method'] })"
        class="rounded-md border-border border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        class="flex-1 rounded-md border-border border bg-background px-2 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="URL 模板，支持 {{var}}"
        :value="api.urlTemplate"
        @input="patch({ urlTemplate: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- 可折叠侧栏分组 -->
    <section v-for="g in ([{ k:'query', title:'Query Parameters', rows:api.query },{ k:'headers', title:'Headers', rows:api.headers }] as const)" :key="g.k" class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open[g.k] = !open[g.k]">
        <span class="text-sm font-medium">{{ g.title }}</span>
        <span class="text-muted-foreground">{{ open[g.k] ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open[g.k]" class="border-t border-border p-3">
        <KvRows :rows="g.rows" @update="patch(g.k === 'query' ? { query: $event } : { headers: $event })" />
      </div>
    </section>

    <section class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open.body = !open.body">
        <span class="text-sm font-medium">Body</span><span class="text-muted-foreground">{{ open.body ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.body" class="border-t border-border p-3">
        <div class="mb-2 flex gap-1">
          <button v-for="bt in bodyTypes" :key="bt" @click="patch({ bodyType: bt })"
            class="rounded-md px-2 py-1 text-xs" :class="api.bodyType === bt ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'">{{ bt }}</button>
        </div>
        <textarea
          class="h-40 w-full rounded-md border-border border bg-background p-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="body 内容（{{var}} 会被提取）"
          :value="api.bodyText"
          @input="patch({ bodyText: ($event.target as HTMLTextAreaElement).value })"
        ></textarea>
      </div>
    </section>

    <!-- 解析配置 -->
    <section class="rounded-lg border border-border">
      <button class="flex w-full items-center justify-between px-3 py-2 text-left" @click="open.parse = !open.parse">
        <span class="text-sm font-medium">解析配置</span><span class="text-muted-foreground">{{ open.parse ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open.parse" class="space-y-2 border-t border-border p-3 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">列表 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.listPath" @input="patchParse({ listPath: ($event.target as HTMLInputElement).value })" placeholder="$.data.list" /></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">总数 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.totalPath" @input="patchParse({ totalPath: ($event.target as HTMLInputElement).value })" /></label>
          <label class="flex flex-col gap-1"><span class="text-xs text-muted-foreground">页码 JSONPath</span>
            <input class="rounded-md border border-border bg-background px-2 py-1 font-mono" :value="parse.pagePath" @input="patchParse({ pagePath: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <div>
          <div class="mb-1 text-xs text-muted-foreground">字段列（name / 标题 / 类型 / 枚举映射）</div>
          <div v-for="(c, i) in parse.columns" :key="i" class="mb-1.5 flex flex-wrap items-center gap-1.5">
            <input class="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono" :value="c.field"
              @input="setCol(i, { field: ($event.target as HTMLInputElement).value })" placeholder="字段名" />
            <input class="w-24 rounded-md border border-border bg-background px-2 py-1" :value="c.title"
              @input="setCol(i, { title: ($event.target as HTMLInputElement).value })" placeholder="标题" />
            <select class="rounded-md border border-border bg-background px-1 py-1" :value="c.type"
              @input="setCol(i, { type: ($event.target as HTMLSelectElement).value as never })">
              <option v-for="t in colTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <input v-if="c.type === 'enum'" class="w-48 rounded-md border border-border bg-background px-2 py-1 font-mono" :value="fmtEnum(c.enumMap)"
              @input="setColEnum(i, ($event.target as HTMLInputElement).value)" placeholder="1:男,2:女" />
            <button class="text-muted-foreground hover:text-destructive" @click="removeCol(i)">✕</button>
          </div>
          <button class="text-sm text-primary hover:underline" @click="addCol">+ 添加列</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  methods: {
    fmtEnum(map: Record<string, string> | undefined): string {
      return map ? Object.entries(map).map(([k, v]) => `${k}:${v}`).join(',') : ''
    },
    setCol(i: number, p: Partial<import('@/lib/debugger/model').ColumnDef>) {
      const cols = (this.$props as { api: ApiRequest }).api.parse.columns.map((c, idx) => (idx === i ? { ...c, ...p } : c))
      this.$emit('update', { ...(this.$props as { api: ApiRequest }).api, parse: { ...((this.$props as { api: ApiRequest }).api.parse), columns: cols }, updatedAt: Date.now() })
    },
    setColEnum(i: number, text: string) {
      const map: Record<string, string> = {}
      text.split(',').forEach((seg) => { const m = seg.trim().split(/[:=]/); if (m[0]) map[m[0].trim()] = (m[1] ?? '').trim() })
      this.setCol(i, { enumMap: map })
    },
    removeCol(i: number) {
      const cols = (this.$props as { api: ApiRequest }).api.parse.columns.filter((_, idx) => idx !== i)
      this.$emit('update', { ...(this.$props as { api: ApiRequest }).api, parse: { ...((this.$props as { api: ApiRequest }).api.parse), columns: cols }, updatedAt: Date.now() })
    },
    addCol() {
      const cols = [...(this.$props as { api: ApiRequest }).api.parse.columns, { field: '', title: '', type: 'text' as const }]
      this.$emit('update', { ...(this.$props as { api: ApiRequest }).api, parse: { ...((this.$props as { api: ApiRequest }).api.parse), columns: cols }, updatedAt: Date.now() })
    },
  },
})
</script>
```

> 说明：ConfigPanel 用 `<script setup>` 含列编辑逻辑较繁，为清晰起见把「解析配置列编辑」放到单独的 `options` 风格的 `defineComponent` 中（延续现有工具对可读性的取舍）；如 Vue SFC 编译该写并存报错，可将 `methods` 逻辑改为普通函数并 `patch(patchParse(...))` 精简。最终以 `npm run build` 通过为准。

- [ ] **Step 3: 把 ConfigPanel 接入 HttpClient 的 activeTab**

在 `HttpClient.vue` 主区改为主 Tab 切换：引入 `ConfigPanel`，当 `activeTab === 'config'` 渲染它并把变更写回：

```vue
<script setup lang="ts">
import ConfigPanel from '@/components/debugger/ConfigPanel.vue'
// …（保留已有 onMounted 逻辑）
function save(api: import('@/lib/debugger/model').ApiRequest) {
  apis.value = { ...apis.value, [api.id]: api }
  void saveApis(apis.value)
}
function select(id: string) { currentId.value = id }
</script>
<template>
  <div class="flex h-full">
    <aside class="w-60 shrink-0 border-r border-border bg-card p-3">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wider text-muted-foreground">接口列表</span>
        <button class="text-sm text-primary hover:underline" @click="">+ 新建</button>
      </div>
      <ul class="space-y-1">
        <li v-for="a in Object.values(apis)" :key="a.id">
          <button class="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            :class="a.id === currentId ? 'bg-accent text-accent-foreground' : ''" @click="select(a.id)">{{ a.name }}</button>
        </li>
      </ul>
    </aside>
    <main class="flex-1 overflow-auto p-4">
      <div class="mb-4 flex gap-1 border-b border-border">
        <button v-for="t in (['config','run','history'] as const)" :key="t" class="px-3 py-2 text-sm"
          :class="activeTab === t ? 'border-b-2 border-primary font-medium' : 'text-muted-foreground'"
          @click="activeTab = t">{{ { config: '配置', run: '运行·可视化', history: '历史' }[t] }}</button>
      </div>
      <template v-if="apis[currentId]">
        <ConfigPanel v-if="activeTab === 'config'" :api="apis[currentId]" @update="save" />
        <p v-else class="text-sm text-muted-foreground">该 Tab 在后续任务实现。</p>
      </template>
    </main>
  </div>
</template>
```

- [ ] **Step 4: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。dev 下「配置」Tab 可编辑 Method/URL/Query/Header/Body/解析配置，刷新后仍在（IndexedDB）。

- [ ] **Step 5: Commit**

```bash
git add src/components/debugger/KvRows.vue src/components/debugger/ConfigPanel.vue src/views/HttpClient.vue
git commit -m "feat(debugger): 配置Tab（请求模板+解析配置，可折叠侧栏）"
```

---

### Task 9: 「运行·可视化」Tab —— 变量表单与发送

**Files:**
- Create: `src/components/debugger/RunPanel.vue`
- Modify: `src/views/HttpClient.vue`

- [ ] **Step 1: 变量表单 + 发送 + 原始响应**

Create `src/components/debugger/RunPanel.vue`：

```vue
<script setup lang="ts">
import type { ApiRequest } from '@/lib/debugger/model'
import { buildRequest } from '@/lib/debugger/builder'
import { collectSnippet, extractPlaceholders, resolveVars, replaceAll } from '@/lib/debugger/variables'
import { parseResponse } from '@/lib/debugger/parse'
import type { ParseResult } from '@/lib/debugger/parse'
import { getGlobals, pushHistory } from '@/lib/debugger/db'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{ api: ApiRequest }>()
const emit = defineEmits<{ (e: 'update', api: ApiRequest): void }>()

const globals = ref<Record<string, string>>({})
const running = ref(false)
const result = ref<{ ok: boolean; status?: number; ms?: number; size?: number; raw: string } | null>(null)
const parsed = ref<ParseResult | null>(null)
const err = ref('')
const view = ref<'raw' | 'table'>('raw')
const timeoutMs = 30000

onMounted(async () => { globals.value = await getGlobals() })

// 从模板自动提取占位符并合并到变量（不覆盖已有默认值/描述）
const varNames = computed(() => extractPlaceholders([collectSnippet(props.api)]))
watch(varNames, (names) => {
  const existing = new Map(props.api.variables.map((v) => [v.name, v]))
  const merged = names.map((n) => existing.get(n) ?? { name: n, value: '' })
  emit('update', { ...props.api, variables: merged })
}, { immediate: true })

const vars = computed(() => props.api.variables.map((v) => ({ name: v.name, value: v.value })))
const resolved = computed(() => resolveVars(vars.value, globals.value))

function setVar(i: number, value: string) {
  const vs = props.api.variables.map((v, idx) => (idx === i ? { ...v, value } : v))
  emit('update', { ...props.api, variables: vs })
}

async function send() {
  running.value = true
  err.value = ''
  result.value = null
  parsed.value = null
  try {
    const built = buildRequest(props.api, resolved.value)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    const t0 = performance.now()
    const resp = await fetch(built.url, built.body !== undefined ? { method: built.method, headers: built.headers, body: built.body, signal: ctl.signal } : { method: built.method, headers: built.headers, signal: ctl.signal })
    const ms = Math.round(performance.now() - t0)
    const raw = await resp.text()
    clearTimeout(timer)
    const size = new Blob([raw]).size
    const entry = { ts: Date.now(), status: resp.status, ms, size, raw }
    void pushHistory(props.api.id, entry)
    result.value = { ok: resp.ok, status: resp.status, ms, size, raw }
    parsed.value = parseResponse(raw, props.api.parse)
  } catch (e) {
    clearTimeout(timer as unknown as number)
    err.value = '发送失败：' + ((e as Error).name === 'AbortError' ? '请求超时' : '多为 CORS 跨域限制或网络不可达')
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 变量表单 -->
    <div class="rounded-lg border border-border p-3">
      <div class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">变量{{ Object.keys(resolved).length ? `（${Object.keys(resolved).length}）` : '' }}</div>
      <div v-if="vars.length" class="grid gap-2 md:grid-cols-2">
        <label v-for="(v, i) in vars" :key="v.name" class="flex flex-col gap-1">
          <span class="text-xs font-mono text-muted-foreground">{{ v.name }}</span>
          <input class="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :value="v.value" :placeholder="globals[props.api.variables[i]?.name ?? v.name] !== undefined ? `默认 ${globals[props.api.variables[i]?.name ?? v.name]}` : ''"
            @input="setVar(i, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
      <p v-else class="text-sm text-muted-foreground">模板中没有 {{var}} 占位符，可直接发送。</p>
      <div class="mt-3"><button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60" :disabled="running" @click="send">{{ running ? '发送中…' : '发送' }}</button></div>
    </div>

    <div v-if="err" class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">⚠️ {{ err }}</div>

    <div v-if="result" class="rounded-lg border border-border">
      <div class="flex items-center gap-3 border-b border-border px-3 py-2 text-sm">
        <span class="font-semibold" :class="result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'">{{ result.status }}</span>
        <span class="text-muted-foreground">{{ result.ms }}ms</span>
        <span class="text-muted-foreground">{{ result.size }} B</span>
        <div class="ml-auto flex gap-1">
          <button class="rounded-md px-2 py-1 text-xs" :class="view === 'raw' ? 'bg-accent' : 'hover:bg-accent'" @click="view='raw'">原始</button>
          <button class="rounded-md px-2 py-1 text-xs" :class="view === 'table' ? 'bg-accent' : 'hover:bg-accent'" @click="view='table'">表格</button>
        </div>
      </div>
      <pre v-if="view === 'raw'" class="max-h-[60vh] overflow-auto p-3 font-mono text-xs">{{ result.raw }}</pre>
      <div v-else-if="parsed && !parsed.ok" class="p-3 text-sm text-muted-foreground">
        {{ parsed.error }}<span v-if="parsed.topKeys?.length">；顶层键：{{ parsed.topKeys.join(', ') }}</span>
      </div>
      <!-- 表格视图在 Task 10 接入 -->
    </div>
  </div>
</template>
```

- [ ] **Step 2: 接入 HttpClient**

在 `HttpClient.vue` 引入 `RunPanel`，`activeTab === 'run'` 时渲染 `<RunPanel :api="apis[currentId]" @update="save" />`。

- [ ] **Step 3: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。用「配置」里填好 url 的接口，切到「运行·可视化」，占位符被提取为表单；点发送能看到原始响应或 CORS 错误横幅。

- [ ] **Step 4: Commit**

```bash
git add src/components/debugger/RunPanel.vue src/views/HttpClient.vue
git commit -m "feat(debugger): 运行Tab（变量表单+发送+原始响应）"
```

---

### Task 10: 表格视图 + 列渲染 + 分页

**Files:**
- Create: `src/components/debugger/ResponseTable.vue`
- Modify: `src/components/debugger/RunPanel.vue`

- [ ] **Step 1: 表格组件**

Create `src/components/debugger/ResponseTable.vue`（接收 `rows`/`total`/`page`/`columns`，并通知父组件请求指定页）：

```vue
<script setup lang="ts">
import type { ColumnDef } from '@/lib/debugger/model'
import { toCellView } from '@/lib/debugger/renderers'
import { computed, ref } from 'vue'

const props = defineProps<{ rows: unknown[]; total?: number; page?: number; pageSize: number; columns: ColumnDef[]; loading?: boolean }>()
const emit = defineEmits<{ (e: 'go', page: number): void }>()
const previewUrl = ref('')

const pageCount = computed(() => props.total !== undefined ? Math.max(1, Math.ceil(props.total / props.pageSize)) : Math.max(1, Math.ceil(props.rows.length / Math.max(1, props.pageSize))))
const cols = computed(() => {
  const seen = new Set<string>()
  props.rows.forEach((r) => { if (r && typeof r === 'object') Object.keys(r as Record<string, unknown>).forEach((k) => seen.add(k)) })
  const effective = props.columns.filter((c) => c.field)
  return effective.length ? effective : [...seen].map((k) => ({ field: k, title: k, type: 'text' as const }))
})
</script>

<template>
  <div class="overflow-auto">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="border-b border-border">
          <th v-for="c in cols" :key="c.field" class="px-3 py-2 whitespace-nowrap font-medium text-muted-foreground">{{ c.title || c.field }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i" class="border-b border-border/60">
          <td v-for="c in cols" :key="c.field" class="px-3 py-2 align-middle">
            <img v-if="toCellView((r as Record<string, unknown>)[c.field], c).kind === 'image'"
              :src="toCellView((r as Record<string, unknown>)[c.field], c).text" class="h-10 w-10 cursor-zoom-in rounded object-cover" @click="previewUrl = toCellView((r as Record<string, unknown>)[c.field], c).text" />
            <a v-else-if="toCellView((r as Record<string, unknown>)[c.field], c).kind === 'link'"
              :href="toCellView((r as Record<string, unknown>)[c.field], c).text" target="_blank" rel="noreferrer" class="text-primary hover:underline">{{ toCellView((r as Record<string, unknown>)[c.field], c).text }}</a>
            <span v-else>{{ toCellView((r as Record<string, unknown>)[c.field], c).text || '-' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="p-4 text-center text-sm text-muted-foreground">{{ loading ? '加载中…' : '无数据' }}</p>
    <div v-if="pageCount > 1" class="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-sm">
      <span class="text-muted-foreground">第 {{ page }} / {{ pageCount }} 页 · 共 {{ total ?? rows.length }} 条</span>
      <button class="rounded-md border border-input bg-background px-2 py-1 hover:bg-accent disabled:opacity-50" :disabled="!page || page <= 1" @click="emit('go', (page ?? 1) - 1)">上一页</button>
      <button class="rounded-md border border-input bg-background px-2 py-1 hover:bg-accent disabled:opacity-50" :disabled="pageCount <= (page ?? 1)" @click="emit('go', (page ?? 1) + 1)">下一页</button>
    </div>
  </div>
  <!-- 图片预览 -->
  <div v-if="previewUrl" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click="previewUrl = ''">
    <img :src="previewUrl" class="max-h-[80vh] max-w-[80vw] rounded-lg" />
  </div>
</template>
```

- [ ] **Step 2: 接入 RunPanel 表格视图**

`RunPanel.vue` 中：引入 `ResponseTable`、`HISTORY_CAP`（分页大小可定为 10），把「表格视图」从占位提示改为渲染：

```typescript
import ResponseTable from './ResponseTable.vue'
const pageSize = 10
const page = ref(1)
const qsPagePath = ref('')
```

把变量表单里新增一个「当前页」输入（绑定 `page`，页面切换时用 `resolved` 里的 `page` 变量或 `pagePath` 对应值回写再发送）：

实现思路（在 `.send()` 之前拼一个 `RequestPatcher`，把所有 `{{page}}` 类占位符替换为当前 `page`）：

```typescript
function effResolved(): Record<string, string> {
  const r = { ...resolved.value }
  // 始终提供 page 覆盖，分页用
  if (props.api.variables.some((v) => v.name === 'page')) r.page = String(page.value)
  return r
}
// 使用 effResolved() 替换原 resolved.value 传入 buildRequest
// 切换分页：page.value = x; 然后调用 send()
```

发送成功后把 `page` 重置为服务端返回的 `parsed.page ?? 1`：

```typescript
// send() 完成处
page.value = parsed.value?.page ?? 1
```

- [ ] **Step 3: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。响应对应 `listPath` 命中时表格正确渲染；枚举/图片/链接/时间列按类型呈现；路径未命中显示提示与顶层键；有分页信息时出现分页条。

- [ ] **Step 4: Commit**

```bash
git add src/components/debugger/ResponseTable.vue src/components/debugger/RunPanel.vue
git commit -m "feat(debugger): 表格视图 + 列类型渲染 + 分页"
```

---

### Task 11: 历史 Tab

**Files:**
- Create: `src/components/debugger/HistoryPanel.vue`
- Modify: `src/views/HttpClient.vue`

- [ ] **Step 1: 历史组件**

Create `src/components/debugger/HistoryPanel.vue`：

```vue
<script setup lang="ts">
import { getHistory, type HistoryEntry } from '@/lib/debugger/db'
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ apiId: string }>()
const entries = ref<HistoryEntry[]>([])
const picked = ref<HistoryEntry | null>(null)
async function load() { entries.value = (await getHistory(props.apiId)).slice(0, 20) }
watch(() => props.apiId, load)
onMounted(load)
</script>

<template>
  <div class="rounded-lg border border-border">
    <ul v-if="entries.length" class="divide-y divide-border text-sm">
      <li v-for="(e, i) in entries" :key="i" class="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent" @click="picked = e">
        <span class="font-mono text-xs" :class="e.status >= 200 && e.status < 300 ? 'text-green-600 dark:text-green-400' : 'text-destructive'">{{ e.status }}</span>
        <span class="text-xs text-muted-foreground">{{ new Date(e.ts).toLocaleString() }}</span>
        <span class="ml-auto text-xs text-muted-foreground">{{ e.ms }}ms · {{ e.size }} B</span>
      </li>
    </ul>
    <p v-else class="p-4 text-sm text-muted-foreground">暂无历史记录。</p>
  </div>
  <pre v-if="picked" class="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-border p-3 font-mono text-xs">{{ picked.raw }}</pre>
</template>
```

- [ ] **Step 2: 接入 HttpClient**

`activeTab === 'history'` && 有 `currentId` 时渲染 `<HistoryPanel :api-id="currentId" />`。

- [ ] **Step 3: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。发送几次后可查看历史并可点开看原始响应体。

- [ ] **Step 4: Commit**

```bash
git add src/components/debugger/HistoryPanel.vue src/views/HttpClient.vue
git commit -m "feat(debugger): 历史Tab"
```

---

### Task 12: 环境管理（全局变量）+ 导入导出

**Files:**
- Create: `src/components/debugger/EnvPanel.vue`
- Create: `src/lib/debugger/io.ts`
- Modify: `src/views/HttpClient.vue`
- Modify: `src/components/debugger/RunPanel.vue`（从 db 读/写全局变量改为与 EnvPanel 共享）

- [ ] **Step 1: 全局变量读写与导入导出（io.ts）**

Create `src/lib/debugger/io.ts`：

```typescript
import type { ApiRequest } from './model.ts'
import { createApiRequest } from './model.ts'

export function exportApi(api: ApiRequest): string {
  return JSON.stringify(api, null, 2)
}

export function importApi(text: string): ApiRequest | null {
  try {
    const obj = JSON.parse(text) as Partial<ApiRequest>
    return createApiRequest(obj)
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 环境管理面板（全局变量编辑 + 导入/导出当前接口）**

Create `src/components/debugger/EnvPanel.vue`：

```vue
<script setup lang="ts">
import type { ApiRequest } from '@/lib/debugger/model'
import { exportApi, importApi } from '@/lib/debugger/io'
import { saveGlobals } from '@/lib/debugger/db'
import { computed } from 'vue'

const props = defineProps<{
  globals: Record<string, string>
  api: ApiRequest
}>()
const emit = defineEmits<{
  (e: 'globals', g: Record<string, string>): void
  (e: 'import', api: ApiRequest): void
}>()

const gvars = computed(() => Object.entries(props.globals))
function set(k: string, v: string, i: number) {
  const entries = Object.entries({ ...props.globals, [k]: v })
  // 这里用对象语义；新增行通过 addGlobal
  const obj: Record<string, string> = {}
  entries.forEach(([key, value]) => { if (key) obj[key] = value })
  emit('globals', obj)
}
function addGlobal() {
  emit('globals', { ...props.globals, ['']: '' })
}
function remove(k: string) {
  const obj = { ...props.globals }
  delete obj[k]
  emit('globals', obj)
}
function doExport() {
  const blob = new Blob([exportApi(props.api)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.api.name}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  file.text().then((t) => { const api = importApi(t); if (api) emit('import', api) })
}
</script>

<template>
  <div class="space-y-4 p-4">
    <section class="rounded-lg border border-border p-3">
      <div class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">全局变量（模板里用 @name 引用）</div>
      <div v-for="([k, v], i) in gvars" :key="i" class="mb-1.5 flex items-center gap-1.5">
        <input class="w-28 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm" :value="k" @input="set(($event.target as HTMLInputElement).value, v, i)" />
        <input class="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm" :value="v" @input="set(k, ($event.target as HTMLInputElement).value, i)" />
        <button class="text-muted-foreground hover:text-destructive" @click="remove(k)">✕</button>
      </div>
      <button class="text-sm text-primary hover:underline" @click="addGlobal">+ 添加变量</button>
    </section>
    <section class="rounded-lg border border-border p-3">
      <div class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">导入 / 导出</div>
      <div class="flex gap-2">
        <button class="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent" @click="doExport">导出当前接口</button>
        <label class="cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent">
          导入接口<input type="file" accept="application/json" class="hidden" @change="onImport" />
        </label>
        <button class="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent" @click="() => navigator.clipboard?.writeText(exportApi(api))">复制为 JSON</button>
      </div>
    </section>
  </div>
</template>
```

- [ ] **Step 3: 接入 HttpClient（环境管理弹层 + 导入合并）**

在 `HttpClient.vue` 增加 `showEnv` ref 与 `globals` ref；顶栏放 ⚙ 按钮；`activeTab` 上方加环境管理入口；合并 import 逻辑：

```typescript
const globals = ref<Record<string, string>>({})
const showEnv = ref(false)
onMounted(async () => { globals.value = await getGlobals() /* + 原有 apis 加载 */ })
function setGlobals(g: Record<string, string>) { globals.value = g; void saveGlobals(g) }
function onImport(api: import('@/lib/debugger/model').ApiRequest) {
  apis.value = { ...apis.value, [api.id]: api }
  currentId.value = api.id
  void saveApis(apis.value)
  showEnv.value = false
}
```

顶栏（主区头部，排在 Tab 右侧）放环境管理入口按钮 `<button @click="showEnv=!showEnv">⚙ 环境管理</button>`，`showEnv` 时在主区渲染 `<EnvPanel :globals="globals" :api="apis[currentId]" @globals="setGlobals" @import="onImport" />`。

- [ ] **Step 4: RunPanel 共享全局变量**

`RunPanel` 中读全局改为：不再 `onMounted` 里自行 `getGlobals`，而是接收父组件传入的 `globals` prop（`defineProps` 增加 `globals: Record<string,string>`），由 HttpClient 传入，从而配置/运行/环境管理三处全局一致：

```typescript
// 在 RunPanel defineProps 补 globals，移除内部 globals ref 与 onMounted 读取
```

- [ ] **Step 5: 构建 + 手动验证**

Run: `npm run build`
Expected: 通过。可在「环境管理」新增全局变量并在模板里用 `@token`；当前接口可导出/导入/复制为 JSON。

- [ ] **Step 6: Commit**

```bash
git add src/lib/debugger/io.ts src/components/debugger/EnvPanel.vue src/views/HttpClient.vue src/components/debugger/RunPanel.vue
git commit -m "feat(debugger): 环境管理（全局变量）+ 导入导出"
```

---

### Task 13: 打磨与收尾

**Files:**
- Modify: `src/views/HttpClient.vue`（新建/重命名/删除接口、底部状态栏）
- Modify: `src/components/debugger/RunPanel.vue`（`新增接口`入口联动）

- [ ] **Step 1: 接口列表增删改 + 状态栏**

在 `HttpClient.vue` 完善左栏：`+ 新建`（`createApiRequest()` 加入并选中）、双击/改名（提供内联 rename）、删除（从 map 移除）；底部加状态栏（当前接口名 + 更新时间）。复用既有工具「返回 + 状态栏」观感。

- [ ] **Step 2: 全量自检 + 构建**

Run: `node scripts/verify-http-client.ts && npm run build`
Expected: 自检全部 `✓`；构建无 `vue-tsc` 报错。

- [ ] **Step 3: 手动验收清单**

在 dev 下逐项核对 spec 覆盖：
- [ ] 配置 Tab：Method/URL/Query/Header/Body 全可编辑且可折叠侧栏，解析配置（listPath/totalPath/pagePath + 列）可编辑
- [ ] 运行·可视化：`{{var}}` 自动提取为表单；发送后原始/表格双视图；非 JSON／路径未命中有提示
- [ ] 表格：枚举映射、图片、链接、datetime、bool 正确渲染；有分页信息时可翻页并回写 `page` 变量重发
- [ ] 历史 Tab 记录最近 20 次，可点开看原始响应
- [ ] 环境管理全局变量可在模板里 `@name` 引用；导入/导出/复制为 JSON 可用
- [ ] CORS 失败横幅出现；暗色模式正常
- [ ] 刷新后数据仍在（IndexedDB）

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(debugger): 打磨收尾（接口管理/状态栏/验收）"
```

---

## 自检（Self-Review）

**Spec 覆盖核对：**
- 配置与可视化分离的顶层 Tab → Task 7/8/9 ✓
- 请求模板+变量、占位符提取/合并/替换 → Task 2/3 ✓
- 可折叠侧栏配置面板 → Task 8 ✓
- 纯前端 fetch + CORS 提示 → Task 9 ✓
- JSONPath 抽 total/page/list → Task 4/9/10 ✓
- 每接口自带解析配置 → 模型 + Task 8 ✓
- 字段类型渲染（枚举/图片/链接/datetime/bool）→ Task 5/10 ✓
- IndexedDB 持久化（接口/历史/全局变量）→ Task 1/6/11/12 ✓
- 环境管理（全局变量）→ Task 12 ✓
- 请求历史 → Task 11 ✓
- 导入导出 → Task 12 ✓
- WS/GraphQL 预留 → 模型 `protocol` 字段 ✓

**补充**：Task 8 的 ConfigPanel 中 `<script setup>` 与 `defineComponent` 并存属计划内的可维护性取舍，若 SFC 编译报错，执行者应把 `methods` 内列编辑逻辑改为独立函数后并入 `<script setup>`（阅读器可自行在其实现时调整，Meet spec 意图即可）。

**已知局限**（已入 spec）：跨域接口被 CORS 拦截时只显示错误横幅，无法像桌面版那样绕过。