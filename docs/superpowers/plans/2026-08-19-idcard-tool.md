# 身份证号工具 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Tauri + Vue 3 工具箱中新增「身份证号工具」页面（`/idcard`），支持校验位校验、发证地查询、出生日期/性别/年龄提取、批量生成、单个/全部复制。

**Architecture:** 纯函数核心模块 `src/lib/idcard.ts`（零依赖，可被 Node 直接运行验证）+ 内置区划数据快照 `src/data/china.json`（开发期从 mumuy/idcard（MIT，即 passer-by.com）下载转换，无运行时联网）+ 数据访问层 `src/lib/areaData.ts` + 单页面视图 `src/views/IdCard.vue`（localStorage 持久化列表）。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Tailwind（语义 token）、vue-router、Node 24（`node xx.ts` 原生运行 TS 做逻辑自检）。

**设计文档:** `docs/superpowers/specs/2026-08-19-idcard-tool-design.md`

**执行环境注意：**
- 沙箱 git 无全局身份配置，**不要**执行 `git config`。所有 commit 使用：
  `git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "..."`
- 本项目无测试框架（设计文档明确：以 `vue-tsc` 类型检查 + Node 自检脚本验证），任务中的「验证」步骤即代替 TDD 断言。
- 网络访问 GitHub raw 需走代理环境变量，`curl` 会自动读取；若下载失败，重试一次再报告。

---

### Task 1: 核心纯函数模块 `src/lib/idcard.ts`

**Files:**
- Create: `src/lib/idcard.ts`

此模块**零 import**（类型全部内置），这样 `scripts/verify-idcard.ts`（Task 3）可用 Node 直接运行。

- [ ] **Step 1: 创建 `src/lib/idcard.ts`，写入以下完整内容**

```ts
// 身份证号解析、校验与生成（纯函数，零依赖）
// 算法与发证地拼接规则参考 mumuy/idcard（passer-by.com，MIT License）
// https://github.com/mumuy/idcard
// 校验位算法：ISO 7064:1983.MOD 11-2（GB 11643-1999）

export type AreaMap = Record<string, string>

/** 区划数据中的占位名称：不参与下拉选项与生成候选 */
export const PLACEHOLDER_NAMES = new Set(['市辖区', '县', '省直辖县级行政区划', '省直辖单位'])

export type InvalidReason =
  | '格式错误'
  | '长度错误'
  | '非法日期'
  | '校验位错误'
  | '未知区划'
  | '暂不支持'

export interface IdInfo {
  valid: boolean
  reason?: InvalidReason
  /** 居民身份证 / 港澳台居民居住证 / ''（无法判断时） */
  type: string
  /** 发证地（省+市+区县拼接） */
  sign: string
  /** 出生日期 YYYY-MM-DD，非法日期时为 '' */
  birthday: string
  /** 男 / 女 / '' */
  sex: string
  /** 周岁；出生日期非法时为 null */
  age: number | null
}

export type Sex = '男' | '女'

export interface GenerateOptions {
  /** 生成数量，默认 10，钳制到 1..500 */
  count?: number
  /** 不填则随机 */
  sex?: Sex
  /** 不填则 0 */
  minAge?: number
  /** 不填则 100 */
  maxAge?: number
  /** 2 位（省）/4 位（市）/6 位（区县）区划码前缀，不填则全国 */
  areaCode?: string
}

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

/** 计算 17 位本体码的校验位（第 18 位） */
export function checksum(body: string): string {
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += Number(body[i]) * WEIGHTS[i]
  }
  return CHECK_CODES[sum % 11]
}

/** 15 位号码升 18 位（出生年前补 19、末位补校验位）；非 15 位数字返回 null */
export function upgrade15to18(id: string): string | null {
  if (!/^\d{15}$/.test(id)) return null
  const body = `${id.slice(0, 6)}19${id.slice(6)}`
  return body + checksum(body)
}

/** 归一化用户输入：trim、x 转大写、15 位转 18 位；无法归一化时返回原因 */
export function normalizeId(input: string): { id?: string; reason?: InvalidReason } {
  const s = input.trim().toUpperCase()
  if (/^\d{15}$/.test(s)) return { id: upgrade15to18(s) as string }
  if (/^\d{17}[0-9X]$/.test(s)) return { id: s }
  if (/^\d+$/.test(s)) return { reason: '长度错误' }
  return { reason: '格式错误' }
}

/** 周岁计算 */
function calcAge(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

/**
 * 解析 18 位身份证号（15 位请先经 normalizeId 转换）。
 * 判定优先级：格式错误 > 暂不支持(93 开头) > 非法日期 > 校验位错误 > 未知区划。
 * reason 为 未知区划 时仍尽量返回生日/性别/年龄；reason 为 非法日期 时不再返回生日等字段。
 */
export function parseId(id: string, areas: AreaMap, now: Date = new Date()): IdInfo {
  const info: IdInfo = { valid: false, type: '', sign: '', birthday: '', sex: '', age: null }

  if (!/^\d{17}[0-9X]$/.test(id)) {
    const s = id.trim()
    info.reason = /^\d+$/.test(s) ? '长度错误' : '格式错误'
    return info
  }

  const district = id.slice(0, 6)
  const province = `${district.slice(0, 2)}0000`
  const city = `${district.slice(0, 4)}00`
  const isHmt = /^(81|82|83)/.test(district)

  // 发证地拼接（规则与 mumuy/idcard china.js 一致）
  if (isHmt) {
    info.type = '港澳台居民居住证'
    info.sign = areas[province] ?? ''
  } else {
    info.type = '居民身份证'
    if (/^(11|12|31|50)/.test(district) || /^\d{2}90/.test(district)) {
      // 直辖市与省直辖县级：省 + 区县（跳过市一级）
      info.sign = (areas[province] ?? '') + (city !== district ? (areas[district] ?? '') : '')
    } else {
      info.sign =
        (areas[province] ?? '') +
        (province !== city ? (areas[city] ?? '') : '') +
        (city !== district ? (areas[district] ?? '') : '')
    }
  }

  // 出生日期
  const y = Number(id.slice(6, 10))
  const mo = Number(id.slice(10, 12))
  const d = Number(id.slice(12, 14))
  const date = new Date(y, mo - 1, d)
  const dateOk =
    mo >= 1 &&
    mo <= 12 &&
    d >= 1 &&
    d <= 31 &&
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d &&
    date.getTime() <= now.getTime()
  if (!dateOk) {
    info.reason = '非法日期'
    return info
  }
  info.birthday = `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`
  info.sex = Number(id.charAt(16)) % 2 === 1 ? '男' : '女'
  info.age = calcAge(date, now)

  // 外国人永久居留身份证（93 开头）不在本工具支持范围
  if (/^93/.test(district)) {
    info.reason = '暂不支持'
    return info
  }

  // 校验位
  if (id.charAt(17) !== checksum(id.slice(0, 17))) {
    info.reason = '校验位错误'
    return info
  }

  // 区划码
  const areaKnown = isHmt ? areas[province] !== undefined : areas[district] !== undefined
  if (!areaKnown) {
    info.reason = '未知区划'
    return info
  }

  info.valid = true
  return info
}

/**
 * 批量生成身份证号，生成结果保证校验位正确、出生日期合法。
 * 候选地址码 = 数据中可解析出名称的 6 位码，排除省市占位码（末两位 00）、
 * 占位名称、港澳台（81/82/83）与外国人（93）段。
 */
export function generateIds(options: GenerateOptions, areas: AreaMap, now: Date = new Date()): string[] {
  const count = Math.max(1, Math.min(500, options.count ?? 10))
  const minAge = Math.max(0, Math.min(150, options.minAge ?? 0))
  const maxAge = Math.max(minAge, Math.min(150, options.maxAge ?? 100))

  let codes = Object.keys(areas).filter(
    (code) =>
      /^\d{6}$/.test(code) &&
      !code.endsWith('00') &&
      !PLACEHOLDER_NAMES.has(areas[code]) &&
      !/^(81|82|83|93)/.test(code),
  )
  if (options.areaCode) {
    const ac = options.areaCode
    const prefixLen = ac.length >= 6 ? 6 : ac.length >= 4 ? 4 : 2
    codes = codes.filter((c) => c.startsWith(ac.slice(0, prefixLen)))
  }
  if (codes.length === 0) return []

  // 年龄 [minAge, maxAge] 对应出生日期区间（精确到天）
  const latest = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate())
  const earliest = new Date(now.getFullYear() - (minAge + 1), now.getMonth(), now.getDate() + 1)
  const span = latest.getTime() - earliest.getTime()

  const result: string[] = []
  const seen = new Set<string>()
  let guard = count * 20
  while (result.length < count && guard-- > 0) {
    const area = codes[Math.floor(Math.random() * codes.length)]!
    const dt = new Date(earliest.getTime() + Math.floor(Math.random() * (span + 1)))
    const ymd =
      `${dt.getFullYear()}` +
      `${String(dt.getMonth() + 1).padStart(2, '0')}` +
      `${String(dt.getDate()).padStart(2, '0')}`
    const wantOdd = options.sex ? options.sex === '男' : Math.random() < 0.5
    const seq = String(Math.floor(Math.random() * 500) * 2 + (wantOdd ? 1 : 0)).padStart(3, '0')
    const body = `${area}${ymd}${seq}`
    const id = body + checksum(body)
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}
```

- [ ] **Step 2: 类型检查**

Run: `cd /workspace && npx vue-tsc --noEmit`
Expected: 无输出（退出码 0）。

- [ ] **Step 3: Commit**

```bash
cd /workspace
git add src/lib/idcard.ts
git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "feat: 身份证号核心解析与生成模块"
```

---

### Task 2: 内置区划数据 `src/data/china.json` + 数据访问层 `src/lib/areaData.ts`

**Files:**
- Create: `src/data/china.json`（脚本生成）
- Create: `src/lib/areaData.ts`
- Modify: `tsconfig.json`（第 11 行附近，增加 `"resolveJsonModule": true`）

- [ ] **Step 1: 下载上游数据并转换为 JSON**

```bash
cd /workspace
mkdir -p src/data /tmp/idcard-data
curl -fsSL --max-time 60 https://raw.githubusercontent.com/mumuy/idcard/main/src/module/data/china.js -o /tmp/idcard-data/china.js
node -e "
const fs = require('fs');
const src = fs.readFileSync('/tmp/idcard-data/china.js', 'utf8');
const areas = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const out = {
  _source: 'https://github.com/mumuy/idcard/blob/main/src/module/data/china.js',
  _license: 'MIT',
  _updatedAt: new Date().toISOString().slice(0, 10),
  areas,
};
fs.writeFileSync('src/data/china.json', JSON.stringify(out, null, 2) + '\n');
console.log('条目数:', Object.keys(areas).length);
console.log('抽查:', areas['110000'], '/', areas['110105'], '/', areas['810000'], '/', areas['440304']);
"
```

Expected: `条目数: 7200` 左右；抽查输出 `北京市 / 朝阳区 / 香港特别行政区 / 福田区`。
说明：上游是合法 JSON 对象字面量（键值均带双引号），直接 `JSON.parse` 对象片段即可；港澳台省级码（810000/820000/830000）已包含在上游数据中，无需补录。

- [ ] **Step 2: 修改 `tsconfig.json`**

在 `compilerOptions` 中 `"moduleResolution": "bundler"` 之后新增一行：

```json
    "resolveJsonModule": true,
```

- [ ] **Step 3: 创建 `src/lib/areaData.ts`，写入以下完整内容**

```ts
// 区划数据访问层：内置 china.json 快照，提供查询、级联下拉选项
import chinaJson from '@/data/china.json'
import { PLACEHOLDER_NAMES, type AreaMap } from '@/lib/idcard'

export interface ChinaData {
  _source: string
  _license: string
  _updatedAt: string
  areas: AreaMap
}

const chinaData = chinaJson as unknown as ChinaData

export const areaSource: string = chinaData._source
export const areaUpdatedAt: string = chinaData._updatedAt
export const areas: AreaMap = chinaData.areas

export interface AreaOption {
  code: string
  name: string
}

/** 省级选项（含港澳台） */
export const provinceOptions: AreaOption[] = Object.entries(areas)
  .filter(([code, name]) => /^\d{2}0000$/.test(code) && !PLACEHOLDER_NAMES.has(name))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))

/** 市级选项；直辖市/省直辖县返回空数组（区县直接挂在省下） */
export function cityOptions(provinceCode: string): AreaOption[] {
  if (!provinceCode) return []
  const prefix = provinceCode.slice(0, 2)
  return Object.entries(areas)
    .filter(
      ([code, name]) =>
        /^\d{4}00$/.test(code) && code.startsWith(prefix) && code !== provinceCode && !PLACEHOLDER_NAMES.has(name),
    )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** 区县选项；传市码取该市下区县，不传市码取全省区县（用于直辖市） */
export function districtOptions(provinceCode: string, cityCode?: string): AreaOption[] {
  if (!provinceCode) return []
  const prefix = cityCode ? cityCode.slice(0, 4) : provinceCode.slice(0, 2)
  return Object.entries(areas)
    .filter(
      ([code, name]) =>
        /^\d{6}$/.test(code) && !code.endsWith('00') && code.startsWith(prefix) && !PLACEHOLDER_NAMES.has(name),
    )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
```

- [ ] **Step 4: 类型检查**

Run: `cd /workspace && npx vue-tsc --noEmit`
Expected: 无输出（退出码 0）。

- [ ] **Step 5: Commit**

```bash
cd /workspace
git add src/data/china.json src/lib/areaData.ts tsconfig.json
git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "feat: 内置区划数据快照与数据访问层"
```

---

### Task 3: 逻辑自检脚本 `scripts/verify-idcard.ts`

**Files:**
- Create: `scripts/verify-idcard.ts`

Node 24 原生运行 TS（类型剥离），`idcard.ts` 零依赖、显式 `.ts` 后缀导入即可直接运行。脚本在 `tsconfig.json` include 范围外，`vue-tsc`/`vite build` 均不受影响。样例校验位均已在计划编写时用独立实现验算过。

- [ ] **Step 1: 创建 `scripts/verify-idcard.ts`，写入以下完整内容**

```ts
// idcard.ts 逻辑自检脚本（设计文档约定的验证方式，非单元测试框架）
// 运行：node scripts/verify-idcard.ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checksum, upgrade15to18, normalizeId, parseId, generateIds } from '../src/lib/idcard.ts'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, '../src/data/china.json'), 'utf8'))
const areas = data.areas as Record<string, string>

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}

console.log('校验位计算')
check('11010519491231002 → X', checksum('11010519491231002') === 'X')
check('44030419850615001 → 5', checksum('44030419850615001') === '5')

console.log('15 位转 18 位')
check('110105491231002 → 11010519491231002X', upgrade15to18('110105491231002') === '11010519491231002X')
check('440524800101001 → 440524198001010013', upgrade15to18('440524800101001') === '440524198001010013')

console.log('归一化')
check('小写 x 转大写', normalizeId('11010519491231002x').id === '11010519491231002X')
check('17 位数字 → 长度错误', normalizeId('11010519491231002').reason === '长度错误')
check('含字母 → 格式错误', normalizeId('11010519491231002a').reason === '格式错误')

console.log('解析：有效样例')
const a = parseId('11010519491231002X', areas)
check('valid', a.valid === true)
check('发证地 北京市朝阳区', a.sign === '北京市朝阳区', a.sign)
check('出生 1949-12-31', a.birthday === '1949-12-31')
check('性别 女', a.sex === '女')
check('年龄 ≥76', (a.age ?? 0) >= 76, String(a.age))

const b = parseId('440304198506150015', areas)
check('valid', b.valid === true)
check('发证地 广东省深圳市福田区', b.sign === '广东省深圳市福田区', b.sign)
check('性别 男', b.sex === '男')

console.log('解析：港澳台居住证')
const hmt = parseId('810000199001010019', areas)
check('类型 港澳台居民居住证', hmt.type === '港澳台居民居住证')
check('发证地 香港特别行政区', hmt.sign === '香港特别行政区', hmt.sign)
check('valid', hmt.valid === true)

console.log('解析：无效样例')
const badSum = parseId('110105194912310021', areas)
check('校验位错误', badSum.reason === '校验位错误' && badSum.valid === false)
const badDate = parseId('130102199902300036', areas)
check('非法日期（2月30日）', badDate.reason === '非法日期')
const unknown = parseId('999999199001010032', areas)
check('未知区划但保留生日', unknown.reason === '未知区划' && unknown.birthday === '1990-01-01')
const foreign = parseId('930000199001010019', areas)
check('暂不支持（93 开头）', foreign.reason === '暂不支持')
const badFormat = parseId('abc', areas)
check('格式错误', badFormat.reason === '格式错误')

console.log('批量生成')
const gen = generateIds({ count: 200, sex: '男', minAge: 20, maxAge: 30, areaCode: '440304' }, areas)
check('生成 200 条', gen.length === 200, String(gen.length))
check('批内无重复', new Set(gen).size === gen.length)
check('全部有效', gen.every((id) => parseId(id, areas).valid))
check('性别全部为男', gen.every((id) => parseId(id, areas).sex === '男'))
check('发证地全部含福田区', gen.every((id) => parseId(id, areas).sign.includes('福田区')))
check('年龄全部 20-30', gen.every((id) => { const age = parseId(id, areas).age ?? -1; return age >= 20 && age <= 30 }))
const genRandom = generateIds({ count: 50 }, areas)
check('随机生成 50 条全部有效', genRandom.length === 50 && genRandom.every((id) => parseId(id, areas).valid))
const genEmpty = generateIds({ count: 10, areaCode: '810000' }, areas)
check('港澳台无候选码返回空数组', genEmpty.length === 0)

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 2: 运行脚本**

Run: `cd /workspace && node scripts/verify-idcard.ts`
Expected: 逐行输出 `✓`，末尾 `全部通过`，退出码 0。任何 `✗` 即失败，修复 `idcard.ts`/`areaData` 后重跑（不许改断言迁就实现）。

- [ ] **Step 3: Commit**

```bash
cd /workspace
git add scripts/verify-idcard.ts
git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "test: 身份证模块逻辑自检脚本"
```

---

### Task 4: 页面 `src/views/IdCard.vue`

**Files:**
- Create: `src/views/IdCard.vue`

样式遵循 `docs/superpowers/specs/2026-08-18-tool-dev-convention.md`：语义 token、主/次按钮、`rounded-lg border` 面板、`focus-visible:ring-2`、暗色模式补 `.dark` 变体。

- [ ] **Step 1: 创建 `src/views/IdCard.vue`，写入以下完整内容**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { normalizeId, parseId, generateIds, type IdInfo, type Sex } from '@/lib/idcard'
import { areas, areaUpdatedAt, provinceOptions, cityOptions, districtOptions } from '@/lib/areaData'

interface IdEntry {
  /** 18 位号码；无法归一化的输入保留原文 */
  id: string
  original: string
  addedAt: number
}

const STORAGE_KEY = 'idcard:list'
const router = useRouter()

const input = ref('')
const entries = ref<IdEntry[]>(loadEntries())
const selectedId = ref('')
const status = ref('')
const showGenerate = ref(false)

// 批量生成配置（全部可留空 = 随机）
const genCount = ref(10)
const genSex = ref<'' | Sex>('')
const genMinAge = ref('')
const genMaxAge = ref('')
const genProvince = ref('')
const genCity = ref('')
const genDistrict = ref('')

function loadEntries(): IdEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter(
      (e): e is IdEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as IdEntry).id === 'string' &&
        typeof (e as IdEntry).original === 'string',
    )
  } catch {
    return []
  }
}

watch(
  entries,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    } catch {
      // 存储失败时静默忽略
    }
  },
  { deep: true },
)

const infos = computed(() => {
  const map = new Map<string, IdInfo>()
  for (const e of entries.value) map.set(e.id, parseId(e.id, areas))
  return map
})

const selectedEntry = computed(() => entries.value.find((e) => e.id === selectedId.value) ?? null)
const selectedInfo = computed(() => (selectedEntry.value ? (infos.value.get(selectedEntry.value.id) ?? null) : null))

const stats = computed(() => {
  let valid = 0
  for (const e of entries.value) if (infos.value.get(e.id)?.valid) valid++
  return { total: entries.value.length, valid, invalid: entries.value.length - valid }
})

const genCities = computed(() => cityOptions(genProvince.value))
const genDistricts = computed(() => districtOptions(genProvince.value, genCity.value || undefined))

watch(genProvince, () => {
  genCity.value = ''
  genDistrict.value = ''
})
watch(genCity, () => {
  genDistrict.value = ''
})

let statusTimer: ReturnType<typeof setTimeout> | undefined
function flashStatus(msg: string): void {
  status.value = msg
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = ''
  }, 3000)
}

/** 入列（去重）并选中第一个 */
function addIds(ids: string[], originals: Map<string, string>): void {
  let first = ''
  let added = 0
  let dup = 0
  for (const id of ids) {
    if (!first) first = id
    if (entries.value.some((e) => e.id === id)) {
      dup++
      continue
    }
    entries.value.push({ id, original: originals.get(id) ?? id, addedAt: Date.now() })
    added++
  }
  selectedId.value = first
  flashStatus(`新增 ${added} 条${dup ? `，已存在 ${dup} 条` : ''}`)
}

function handleSubmit(): void {
  const lines = input.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!lines.length) return
  const ids: string[] = []
  const originals = new Map<string, string>()
  for (const line of lines) {
    const norm = normalizeId(line)
    const id = norm.id ?? line
    if (!ids.includes(id)) ids.push(id)
    originals.set(id, line)
  }
  addIds(ids, originals)
  input.value = ''
}

function handleGenerate(): void {
  const areaCode = genDistrict.value || genCity.value || genProvince.value || undefined
  const ids = generateIds(
    {
      count: Number(genCount.value) || 10,
      sex: genSex.value || undefined,
      minAge: genMinAge.value === '' ? undefined : Number(genMinAge.value),
      maxAge: genMaxAge.value === '' ? undefined : Number(genMaxAge.value),
      areaCode,
    },
    areas,
  )
  if (!ids.length) {
    flashStatus('生成失败：该地区无可用区划码')
    return
  }
  addIds(ids, new Map(ids.map((id) => [id, id])))
}

async function copyText(text: string, msg: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    flashStatus(msg)
  } catch {
    flashStatus('复制失败')
  }
}

function copyOne(id: string): void {
  void copyText(id, '已复制 1 条')
}

function copyAll(): void {
  if (!entries.value.length) return
  void copyText(
    entries.value.map((e) => e.id).join('\n'),
    `已复制 ${entries.value.length} 条`,
  )
}

function clearAll(): void {
  entries.value = []
  selectedId.value = ''
  flashStatus('列表已清空')
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">身份证号工具</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="copyAll"
        >
          全部复制
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="clearAll"
        >
          清空列表
        </button>
      </div>
    </div>

    <!-- 输入区（居中卡片） -->
    <div class="mx-auto w-full max-w-2xl rounded-lg border bg-card">
      <div class="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        ⌨️ 输入身份证号
      </div>
      <div class="p-3">
        <textarea
          v-model="input"
          rows="3"
          placeholder="输入身份证号，一行一个（支持 15 位自动转 18 位），回车确认，Shift+Enter 换行..."
          spellcheck="false"
          autocomplete="off"
          class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter.exact.prevent="handleSubmit"
        />
        <div class="mt-2 flex items-center gap-2">
          <button
            class="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            @click="handleSubmit"
          >
            确认
          </button>
          <button
            class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
            @click="showGenerate = !showGenerate"
          >
            批量生成
          </button>
        </div>

        <!-- 批量生成配置（均可留空 = 随机） -->
        <div v-if="showGenerate" class="mt-3 space-y-2 rounded-md border bg-background p-3">
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">数量</span>
              <input
                v-model.number="genCount"
                type="number"
                min="1"
                max="500"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">性别</span>
              <select
                v-model="genSex"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">随机</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">年龄</span>
              <div class="flex flex-1 items-center gap-1">
                <input
                  v-model="genMinAge"
                  type="number"
                  placeholder="最小"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span class="text-muted-foreground">-</span>
                <input
                  v-model="genMaxAge"
                  type="number"
                  placeholder="最大"
                  class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">省份</span>
              <select
                v-model="genProvince"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">全国随机</option>
                <option v-for="p in provinceOptions" :key="p.code" :value="p.code">{{ p.name }}</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">城市</span>
              <select
                v-model="genCity"
                :disabled="!genProvince"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">{{ genCities.length ? '随机' : '全部' }}</option>
                <option v-for="c in genCities" :key="c.code" :value="c.code">{{ c.name }}</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <span class="w-14 shrink-0 text-muted-foreground">区县</span>
              <select
                v-model="genDistrict"
                :disabled="!genProvince"
                class="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">随机</option>
                <option v-for="d in genDistricts" :key="d.code" :value="d.code">{{ d.name }}</option>
              </select>
            </label>
          </div>
          <button
            class="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            @click="handleGenerate"
          >
            生成
          </button>
        </div>
      </div>
    </div>

    <!-- 主区：左列表 + 右预览 -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr,1.2fr]">
      <div class="flex flex-col rounded-lg border">
        <div class="flex items-center border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          📋 身份证号列表
          <span class="ml-auto normal-case tracking-normal">共 {{ stats.total }} 条</span>
        </div>
        <div
          v-if="!entries.length"
          class="flex min-h-[240px] flex-1 items-center justify-center p-4 text-sm text-muted-foreground"
        >
          暂无数据，请在上方输入或生成
        </div>
        <ul v-else class="max-h-[480px] divide-y overflow-y-auto">
          <li v-for="e in entries" :key="e.id">
            <div
              role="button"
              tabindex="0"
              class="group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              :class="selectedId === e.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'"
              @click="selectedId = e.id"
              @keydown.enter.prevent="selectedId = e.id"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate font-mono">{{ e.id }}</div>
                <div v-if="e.original !== e.id" class="text-xs text-muted-foreground">
                  由 15 位升位：{{ e.original }}
                </div>
              </div>
              <span
                class="shrink-0 rounded px-1.5 py-0.5 text-xs"
                :class="
                  infos.get(e.id)?.valid
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/15 text-destructive'
                "
              >
                {{ infos.get(e.id)?.valid ? '✓ 通过' : '✗ 不通过' }}
              </span>
              <button
                class="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 group-hover:opacity-100"
                title="复制"
                @click.stop="copyOne(e.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          🔍 信息预览
        </div>
        <div
          v-if="!selectedEntry"
          class="flex min-h-[240px] flex-1 items-center justify-center p-4 text-sm text-muted-foreground"
        >
          点击左侧列表中的身份证号查看详情
        </div>
        <div v-else-if="selectedInfo" class="space-y-3 p-4">
          <div
            v-if="!selectedInfo.valid"
            class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>⚠️</span>
            <span>无效：{{ selectedInfo.reason }}</span>
          </div>
          <div
            v-else
            class="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <span>✓</span>
            <span>校验通过</span>
          </div>
          <dl class="space-y-2 text-sm">
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">身份证号</dt>
              <dd class="min-w-0 break-all font-mono">{{ selectedEntry.id }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">发证地</dt>
              <dd>{{ selectedInfo.sign || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">出生日期</dt>
              <dd>{{ selectedInfo.birthday || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">性别</dt>
              <dd>{{ selectedInfo.sex || '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">年龄</dt>
              <dd>{{ selectedInfo.age !== null ? selectedInfo.age + ' 岁' : '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">号码类型</dt>
              <dd>{{ selectedInfo.type || '—' }}</dd>
            </div>
            <div v-if="selectedEntry.original !== selectedEntry.id" class="flex gap-2">
              <dt class="w-20 shrink-0 text-muted-foreground">原始输入</dt>
              <dd class="font-mono">{{ selectedEntry.original }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>📦 内置区划数据 · {{ areaUpdatedAt }}</span>
      <span class="order-last w-full text-center sm:order-none sm:w-auto sm:flex-1" :class="status ? 'text-foreground' : ''">
        {{ status }}
      </span>
      <span>共 {{ stats.total }} · 有效 {{ stats.valid }} · 无效 {{ stats.invalid }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查**

Run: `cd /workspace && npx vue-tsc --noEmit`
Expected: 无输出（退出码 0）。

- [ ] **Step 3: Commit**

```bash
cd /workspace
git add src/views/IdCard.vue
git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "feat: 身份证号工具页面"
```

---

### Task 5: 路由注册 + 首页入口

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/Home.vue`

- [ ] **Step 1: `src/router/index.ts` 在 `/json` 路由对象之后追加路由**

在 `component: () => import('@/views/Json.vue'),` 对应的 `},` 之后插入：

```ts
    {
      path: '/idcard',
      name: 'idcard',
      component: () => import('@/views/IdCard.vue'),
    },
```

- [ ] **Step 2: `src/views/Home.vue` 的 `tools` 数组在 JSON 编辑器条目后追加**

在 JSON 编辑器对象 `},` 之后插入：

```ts
  {
    icon: '🪪',
    name: '身份证号工具',
    description: '校验位校验、发证地与生日性别年龄解析、批量生成与复制',
    route: '/idcard',
    tag: 'v1.1',
  },
```

- [ ] **Step 3: 类型检查**

Run: `cd /workspace && npx vue-tsc --noEmit`
Expected: 无输出（退出码 0）。

- [ ] **Step 4: Commit**

```bash
cd /workspace
git add src/router/index.ts src/views/Home.vue
git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "feat: 注册身份证号工具路由与首页入口"
```

---

### Task 6: 构建验证 + 手动验收

**Files:** 无新增（只验证，发现问题修复后补充提交）

- [ ] **Step 1: 全量构建**

Run: `cd /workspace && npm run build`
Expected: `vue-tsc --noEmit && vite build` 均成功退出码 0；产物含 `IdCard-*.js` chunk。

- [ ] **Step 2: 重跑逻辑自检**

Run: `cd /workspace && node scripts/verify-idcard.ts`
Expected: `全部通过`。

- [ ] **Step 3: 启动开发服务器做手动验收**

Run: `cd /workspace && npm run dev`（非阻塞，读取输出 URL，默认 `http://localhost:5173`）

用浏览器（或 browser_use 子代理）逐项验收，预期结果：

1. 首页出现「身份证号工具」卡片，点击进入 `/idcard`
2. 输入框粘贴多行（含一个有效号 `11010519491231002X`、一个校验位错误号 `110105194912310021`、一个 15 位号 `110105491231002`、一个乱写号 `abc123`），点「确认」→ 列表出现 4 行，第一行被选中（高亮）；有效行绿标、错误行红标；15 位行显示「由 15 位升位」
3. 依次点击各行：右侧预览显示 发证地/出生日期/性别/年龄/号码类型；无效行顶部红色横幅显示原因
4. 焦点在输入框时按 Enter → 提交（列表更新）；Shift+Enter → 换行不提交
5. 重复提交同一号码 → 列表不重复，提示「已存在 N 条」
6. 展开「批量生成」：数量 5、性别 女、年龄 18-30、省份广东省、城市深圳市、区县福田区 → 点「生成」→ 列表新增 5 条，全部绿标，预览发证地为「广东省深圳市福田区」
7. 只选省份（如 北京市，城市下拉为「全部」）生成 → 发证地为「北京市朝阳区」样式（省+区县）
8. 列表行悬停出现复制图标，点击 → 状态栏「已复制 1 条」；顶栏「全部复制」→「已复制 N 条」
9. 刷新页面 → 列表仍在（localStorage）；「清空列表」→ 列表清空且刷新后仍为空
10. 底部状态栏左侧显示「📦 内置区划数据 · <今天日期>」，右侧统计与列表一致
11. 切换暗色模式 → 页面颜色正常（无死色值）

- [ ] **Step 4: 验收问题修复（如有）**

任何不符合项：修复后重跑 Step 1/2 并单独提交：
`git -c user.name="SpencerSwagger" -c user.email="51152244+spencerswagger@users.noreply.github.com" commit -m "fix: 身份证号工具验收问题修复"`

- [ ] **Step 5: 停止开发服务器，确认工作区干净**

Run: `cd /workspace && git status && git log --oneline -6`
Expected: working tree clean；6 个新提交（含设计文档提交则共 6~7 个）。

---

## Self-Review 记录

- **Spec 覆盖**：校验位校验（Task 1/3/4 标签）、发证地查询（parseId + china.json）、出生日期/性别/年龄（parseId）、批量生成含全部可选配置（generateIds + 生成面板）、单个/全部复制（copyOne/copyAll）、15 转 18（upgrade15to18/normalizeId）、去重与选中第一个（addIds）、localStorage 持久化与清空（watch/clearAll）、内置数据+快照日期显示（areaUpdatedAt/状态栏）、离线可用（零运行时网络）——均有对应任务。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码；所有验证样例的期望值均经独立验算。
- **类型一致性**：`PLACEHOLDER_NAMES`/`AreaMap` 定义于 `idcard.ts`、`areaData.ts` 单向导入（无环）；`IdEntry` 仅在 `IdCard.vue` 内部使用；`GenerateOptions.areaCode` 传 6 位省码（`provinceOptions` 的 code 即 `110000` 形式）与 `generateIds` 的前缀长度规则（≥6 取 6）匹配；`normalizeId` 返回 `{ id?; reason? }` 与 `handleSubmit` 用法一致。
