# 单位换算工具实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Tauri + Vue 3 工具箱新增「单位换算」页面（`/units`）：输入 `30kg`、`$1.99`、`2h`、`5'9"`、`1/2` 等自然文本片段，词法自动识别数值与单位/货币符号，一次列出该量纲下全部等价项，每项可复制；附折叠的手动换算表；汇率采用「内置快照 → indexedDB 缓存(24h) → 在线刷新」降级链。

**Architecture:** 纯函数核心库 `src/lib/units/*`（registry 单位注册表 → lexer 词法切分 → convert 等价换算，货币经 money 走快照汇率），全部零依赖、可被 Node 直接运行自检；`rates.ts` 负责 stale-while-revalidate 数据链（浏览器侧）；`Units.vue` 仅做编排与展示，遵循 tool-dev-convention（顶栏 + 输入 + 结果卡片 + 折叠手动表 + 底部状态栏）。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Tailwind（语义 token）、vue-router、radix-vue Tooltip、IndexedDB、Node 24（`node xx.ts` 原生运行 TS 自检）、Vite。

**设计文档:** `docs/superpowers/specs/2026-08-22-units-tool-design.md`

**执行环境注意：**
- 沙箱已配置 git 全局身份，直接 `git commit` 即可，**不要**执行 `git config`。
- `node_modules/` 当前缺失（含 radix-vue），Task 1 先 `npm install` 恢复。
- 本项目无测试框架（沿用 idcard 惯例）：`vue-tsc --noEmit` 保证 `src/` 类型正确，`node scripts/verify-units.ts` 做逻辑自检（Task 3/4/5/6 增量追加断言并运行）。
- 相对导入必须带 `.ts` 扩展名（Node 原生 TS 需要），`allowImportingTsExtensions` 已开启，`src/` 内代码同样用 `.ts` 扩展名（见 `src/lib/text/smartdecode.ts` 先例）。
- `tsconfig` 开启 `strict` + `noUnusedLocals` + `noUnusedParameters`：`src/` 下代码不得有未使用导入/变量/参数。
- `scripts/` 不在 `vue-tsc` include 范围，脚本不受 unused 检查约束。

---

### Task 1: 恢复依赖（npm install）

**Files:**
- 无新增

- [ ] **Step 1: 安装依赖**

```bash
npm install
```

Expected: 从 `package-lock.json` 恢复全部依赖（含 radix-vue），退出码 0，无 error。

- [ ] **Step 2: 确认 Node 版本与 radix-vue 就位**

```bash
node --version && npm ls radix-vue
```

Expected: `node` 输出 ≥ v22.6（本环境为 v24，原生运行 `.ts` 无需 flag）；`npm ls radix-vue` 显示已安装（如 `radix-vue@1.9.x`）。

---

### Task 2: 单位注册表 `registry.ts`

**Files:**
- Create: `src/lib/units/registry.ts`

- [ ] **Step 1: 创建 `src/lib/units/registry.ts`，写入以下完整内容**

```ts
// 单位注册表：8 种量纲、别名 → 规范单位、线性/非线性换算因子
// 换算基准：长度 m / 重量 kg / 数据量 B(1000 进制) / 温度 ℃ / 面积 ㎡ / 体积 L / 时间 s / 货币 USD
// 货币汇率是运行时数据（见 money.ts），此处仅登记币种别名供词法识别。

export type Dim = 'length' | 'weight' | 'data' | 'temperature' | 'area' | 'volume' | 'time' | 'currency'

export interface UnitDef {
  /** 规范名（如 km、斤、℉） */
  canonical: string
  /** 展示名 */
  name: string
  dim: Dim
  /** 线性换算：valueInBase = value * factor（相对该量纲基准） */
  factor?: number
  /** 非线性换算（温度）：该单位 → 基准 ℃ */
  toBase?: (v: number) => number
  /** 非线性换算（温度）：基准 ℃ → 该单位 */
  fromBase?: (v: number) => number
  /** 结果为近似值（month/year） */
  approx?: boolean
}

export interface DimDef {
  id: Dim
  label: string
  base: string
}

export const DIMS: DimDef[] = [
  { id: 'length', label: '长度', base: 'm' },
  { id: 'weight', label: '重量', base: 'kg' },
  { id: 'data', label: '数据量', base: 'B' },
  { id: 'temperature', label: '温度', base: '℃' },
  { id: 'area', label: '面积', base: '㎡' },
  { id: 'volume', label: '体积', base: 'L' },
  { id: 'time', label: '时间', base: 's' },
  { id: 'currency', label: '货币', base: 'USD' },
]

export const DIM_LABEL: Record<Dim, string> = DIMS.reduce(
  (acc, d) => {
    acc[d.id] = d.label
    return acc
  },
  {} as Record<Dim, string>,
)

export const UNITS: Record<Dim, UnitDef[]> = {
  length: [
    { canonical: 'km', name: '千米', dim: 'length', factor: 1e3 },
    { canonical: 'm', name: '米', dim: 'length', factor: 1 },
    { canonical: 'cm', name: '厘米', dim: 'length', factor: 1e-2 },
    { canonical: 'mm', name: '毫米', dim: 'length', factor: 1e-3 },
    { canonical: 'in', name: '英寸', dim: 'length', factor: 0.0254 },
    { canonical: 'ft', name: '英尺', dim: 'length', factor: 0.3048 },
    { canonical: 'yd', name: '码', dim: 'length', factor: 0.9144 },
    { canonical: 'mi', name: '英里', dim: 'length', factor: 1609.344 },
    { canonical: '里', name: '里', dim: 'length', factor: 500 },
    { canonical: '尺', name: '尺', dim: 'length', factor: 1 / 3 },
    { canonical: '寸', name: '寸', dim: 'length', factor: 1 / 30 },
  ],
  weight: [
    { canonical: 't', name: '吨', dim: 'weight', factor: 1e3 },
    { canonical: 'kg', name: '千克', dim: 'weight', factor: 1 },
    { canonical: 'g', name: '克', dim: 'weight', factor: 1e-3 },
    { canonical: 'mg', name: '毫克', dim: 'weight', factor: 1e-6 },
    { canonical: 'μg', name: '微克', dim: 'weight', factor: 1e-9 },
    { canonical: 'lb', name: '磅', dim: 'weight', factor: 0.45359237 },
    { canonical: 'oz', name: '盎司', dim: 'weight', factor: 0.028349523125 },
    { canonical: '斤', name: '斤', dim: 'weight', factor: 0.5 },
    { canonical: '两', name: '两', dim: 'weight', factor: 0.05 },
  ],
  data: [
    { canonical: 'TB', name: '太字节', dim: 'data', factor: 1e12 },
    { canonical: 'GB', name: '吉字节', dim: 'data', factor: 1e9 },
    { canonical: 'MB', name: '兆字节', dim: 'data', factor: 1e6 },
    { canonical: 'KB', name: '千字节', dim: 'data', factor: 1e3 },
    { canonical: 'B', name: '字节', dim: 'data', factor: 1 },
  ],
  temperature: [
    { canonical: '℃', name: '摄氏度', dim: 'temperature', toBase: (v) => v, fromBase: (v) => v },
    {
      canonical: '℉',
      name: '华氏度',
      dim: 'temperature',
      toBase: (v) => ((v - 32) * 5) / 9,
      fromBase: (v) => (v * 9) / 5 + 32,
    },
    { canonical: 'K', name: '开尔文', dim: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  area: [
    { canonical: 'km²', name: '平方公里', dim: 'area', factor: 1e6 },
    { canonical: 'ha', name: '公顷', dim: 'area', factor: 1e4 },
    { canonical: '英亩', name: '英亩', dim: 'area', factor: 4046.8564224 },
    { canonical: '亩', name: '亩', dim: 'area', factor: 2000 / 3 },
    { canonical: 'ft²', name: '平方英尺', dim: 'area', factor: 0.09290304 },
    { canonical: '平方尺', name: '平方尺', dim: 'area', factor: 1 / 9 },
    { canonical: '㎡', name: '平方米', dim: 'area', factor: 1 },
  ],
  volume: [
    { canonical: 'm³', name: '立方米', dim: 'volume', factor: 1e3 },
    { canonical: 'L', name: '升', dim: 'volume', factor: 1 },
    { canonical: 'mL', name: '毫升', dim: 'volume', factor: 1e-3 },
    { canonical: 'cm³', name: '立方厘米', dim: 'volume', factor: 1e-3 },
    { canonical: 'gal', name: '加仑(美制)', dim: 'volume', factor: 3.785411784 },
  ],
  time: [
    { canonical: 'year', name: '年', dim: 'time', factor: 31536000, approx: true },
    { canonical: 'month', name: '月', dim: 'time', factor: 2592000, approx: true },
    { canonical: 'week', name: '周', dim: 'time', factor: 604800 },
    { canonical: 'day', name: '天', dim: 'time', factor: 86400 },
    { canonical: 'h', name: '小时', dim: 'time', factor: 3600 },
    { canonical: 'min', name: '分钟', dim: 'time', factor: 60 },
    { canonical: 's', name: '秒', dim: 'time', factor: 1 },
    { canonical: 'ms', name: '毫秒', dim: 'time', factor: 1e-3 },
  ],
  currency: [],
}

export interface AliasDef {
  canonical: string
  dim: Dim
  /** 歧义消解权重（越大越优先），默认 0 */
  weight?: number
}

const a = (canonical: string, dim: Dim, weight = 0): AliasDef => ({ canonical, dim, weight })

/** 别名 → 规范单位（含中/英/符号多别名；币种代码与中文名也在此，供词法后置识别） */
export const ALIASES: Record<string, AliasDef> = {
  // 长度 length
  km: a('km', 'length'), 千米: a('km', 'length'), 公里: a('km', 'length'),
  m: a('m', 'length', 5), 米: a('m', 'length'), 公尺: a('m', 'length'),
  cm: a('cm', 'length'), 厘米: a('cm', 'length'), 公分: a('cm', 'length'),
  mm: a('mm', 'length'), 毫米: a('mm', 'length'),
  in: a('in', 'length'), inch: a('in', 'length'), inches: a('in', 'length'), 英寸: a('in', 'length'), '"': a('in', 'length'),
  ft: a('ft', 'length'), foot: a('ft', 'length'), feet: a('ft', 'length'), 英尺: a('ft', 'length'), "'": a('ft', 'length'),
  yd: a('yd', 'length'), yard: a('yd', 'length'), yards: a('yd', 'length'), 码: a('yd', 'length'),
  mi: a('mi', 'length'), mile: a('mile', 'length'), miles: a('mi', 'length'), 英里: a('mi', 'length'),
  里: a('里', 'length', 1), 华里: a('里', 'length'),
  尺: a('尺', 'length', 1), 市尺: a('尺', 'length'),
  寸: a('寸', 'length', 1), 市寸: a('寸', 'length'),
  // 重量 weight
  t: a('t', 'weight'), tonne: a('t', 'weight'), tonnes: a('t', 'weight'), 吨: a('t', 'weight'),
  kg: a('kg', 'weight'), 千克: a('kg', 'weight'), 公斤: a('kg', 'weight'),
  g: a('g', 'weight'), 克: a('g', 'weight'),
  mg: a('mg', 'weight'), 毫克: a('mg', 'weight'),
  μg: a('μg', 'weight'), ug: a('μg', 'weight'), 微克: a('μg', 'weight'),
  lb: a('lb', 'weight'), lbs: a('lb', 'weight'), 磅: a('lb', 'weight'),
  oz: a('oz', 'weight'), 盎司: a('oz', 'weight'),
  斤: a('斤', 'weight', 1),
  两: a('两', 'weight', 1),
  // 数据量 data（1000 进制，大小写都收）
  TB: a('TB', 'data'), tb: a('TB', 'data'),
  GB: a('GB', 'data'), gb: a('GB', 'data'),
  MB: a('MB', 'data'), mb: a('MB', 'data'),
  KB: a('KB', 'data'), kb: a('KB', 'data'),
  B: a('B', 'data', 5), b: a('B', 'data', 1),
  // 温度 temperature
  ℃: a('℃', 'temperature'), '°C': a('℃', 'temperature'), 摄氏度: a('℃', 'temperature'),
  ℉: a('℉', 'temperature'), '°F': a('℉', 'temperature'), 华氏度: a('℉', 'temperature'),
  K: a('K', 'temperature', 1), 开尔文: a('K', 'temperature'),
  // 面积 area
  '㎡': a('㎡', 'area'), 'm²': a('㎡', 'area'), 平方米: a('㎡', 'area'),
  'km²': a('km²', 'area'), 平方公里: a('km²', 'area'),
  ha: a('ha', 'area'), 公顷: a('ha', 'area'),
  亩: a('亩', 'area', 1),
  平方尺: a('平方尺', 'area'), '尺²': a('平方尺', 'area'),
  'ft²': a('ft²', 'area'), sqft: a('ft²', 'area'), 平方英尺: a('ft²', 'area'),
  英亩: a('英亩', 'area'), acre: a('英亩', 'area'), acres: a('英亩', 'area'),
  // 体积 volume
  L: a('L', 'volume', 2), l: a('L', 'volume', 1), 升: a('L', 'volume'),
  mL: a('mL', 'volume'), ml: a('mL', 'volume'), 毫升: a('mL', 'volume'),
  'm³': a('m³', 'volume'), 立方米: a('m³', 'volume'),
  'cm³': a('cm³', 'volume'), cc: a('cm³', 'volume'), 立方厘米: a('cm³', 'volume'),
  gal: a('gal', 'volume'), gallon: a('gal', 'volume'), gallons: a('gal', 'volume'), 加仑: a('gal', 'volume'),
  // 时间 time
  ms: a('ms', 'time'), 毫秒: a('ms', 'time'),
  s: a('s', 'time'), sec: a('s', 'time'), secs: a('s', 'time'), second: a('s', 'time'), seconds: a('s', 'time'), 秒: a('s', 'time'),
  min: a('min', 'time'), mins: a('min', 'time'), minute: a('min', 'time'), minutes: a('min', 'time'), 分钟: a('min', 'time'), 分: a('min', 'time'),
  h: a('h', 'time'), hr: a('h', 'time'), hrs: a('h', 'time'), hour: a('h', 'time'), hours: a('h', 'time'), 小时: a('h', 'time'), 时: a('h', 'time'),
  day: a('day', 'time'), days: a('day', 'time'), d: a('day', 'time'), 天: a('day', 'time'), 日: a('day', 'time'),
  week: a('week', 'time'), weeks: a('week', 'time'), wk: a('week', 'time'), 周: a('week', 'time'), 星期: a('week', 'time'),
  month: a('month', 'time'), months: a('month', 'time'), 月: a('month', 'time'),
  year: a('year', 'time'), years: a('year', 'time'), yr: a('year', 'time'), 年: a('year', 'time'),
  // 货币 currency（供后置词识别；换算走 money.ts）
  USD: a('USD', 'currency'), usd: a('USD', 'currency'), 美元: a('USD', 'currency'),
  CNY: a('CNY', 'currency'), cny: a('CNY', 'currency'), 人民币: a('CNY', 'currency'), 元: a('CNY', 'currency', 1),
  EUR: a('EUR', 'currency'), eur: a('EUR', 'currency'), 欧元: a('EUR', 'currency'),
  GBP: a('GBP', 'currency'), gbp: a('GBP', 'currency'), 英镑: a('GBP', 'currency'),
  JPY: a('JPY', 'currency'), jpy: a('JPY', 'currency'), 日元: a('JPY', 'currency'), 円: a('JPY', 'currency'),
  HKD: a('HKD', 'currency'), hkd: a('HKD', 'currency'), 港币: a('HKD', 'currency'),
  AUD: a('AUD', 'currency'), aud: a('AUD', 'currency'), 澳元: a('AUD', 'currency'),
  CAD: a('CAD', 'currency'), cad: a('CAD', 'currency'), 加元: a('CAD', 'currency'),
  SGD: a('SGD', 'currency'), sgd: a('SGD', 'currency'), 新加坡元: a('SGD', 'currency'),
  CHF: a('CHF', 'currency'), chf: a('CHF', 'currency'), 瑞郎: a('CHF', 'currency'), 瑞士法郎: a('CHF', 'currency'),
}

export const MAX_ALIAS_LEN: number = Math.max(0, ...Object.keys(ALIASES).map((k) => k.length))

export function findUnit(dim: Dim, canonical: string): UnitDef | undefined {
  return UNITS[dim].find((u) => u.canonical === canonical)
}
```

- [ ] **Step 2: 冒烟验证注册表**

```bash
node -e "import('./src/lib/units/registry.ts').then((m) => { const ok = m.UNITS.length.length === 11 && m.UNITS.weight.length === 9 && m.UNITS.data.length === 5 && m.UNITS.temperature.length === 3 && m.UNITS.area.length === 7 && m.UNITS.volume.length === 5 && m.UNITS.time.length === 8 && m.UNITS.currency.length === 0 && m.findUnit('length', 'km').factor === 1000 && m.ALIASES['公斤'].canonical === 'kg' && m.ALIASES['新加坡元'].canonical === 'SGD' && m.ALIASES['JPY'].dim === 'currency'; if (ok) { console.log('registry ok'); process.exit(0) } else { console.log('registry FAIL'); process.exit(1) } })"
```

Expected: 输出 `registry ok`，退出码 0。

---

### Task 3: 词法引擎 `lexer.ts` + 自检脚本（词法部分）

**Files:**
- Create: `src/lib/units/lexer.ts`
- Create: `scripts/verify-units.ts`

- [ ] **Step 1: 创建 `src/lib/units/lexer.ts`，写入以下完整内容**

```ts
// 词法引擎：单一 token 管道，统一建模前置符号 / 后置单位 / 复合符号
// token = [符号?] 数值 [单位?]；数值支持 整数/小数/千分位/科学计数/分数/英尺-英寸复合
import { ALIASES, MAX_ALIAS_LEN, findUnit, type AliasDef, type Dim } from './registry.ts'

export interface Token {
  /** 原始片段（含符号与数值；不含后置单位） */
  raw: string
  value?: number
  /** 规范单位（km、斤、USD…）；无单位时为空 */
  unit?: string
  /** 前置货币符号（$、¥、JP¥…） */
  symbol?: string
  dim?: Dim
  /** 无法识别原因（无法识别单位 / 数字格式异常） */
  error?: string
}

// 前置货币符号（多字符优先），最长匹配
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  HK$: 'HKD', US$: 'USD', CN¥: 'CNY', JP¥: 'JPY',
  A$: 'AUD', C$: 'CAD', S$: 'SGD',
  $: 'USD', ¥: 'CNY', €: 'EUR', £: 'GBP', 円: 'JPY',
}

const SYM_PATTERN = String.raw`HK\$|US\$|CN¥|JP¥|A\$|C\$|S\$|\$|¥|€|£|円`
const COMPOSITE = String.raw`(\d+)[']\s*(\d+)["]?`
const FRACTION = String.raw`(\d+\s*\/\s*\d+)`
const SCI = String.raw`(\d+(?:\.\d+)?[eE][+-]?\d+)`
const NUM = String.raw`(\d[\d,]*(?:\.\d+)?|\.\d+)`
const TOKEN_RE = new RegExp(`(${SYM_PATTERN})?(-?)(?:${COMPOSITE}|${FRACTION}|${SCI}|${NUM})`, 'g')

/** 在 pos 处对注册表别名做最长匹配（允许数字与单位间有空白）；无命中返回 null */
function matchUnitAt(text: string, pos: number): AliasDef | null {
  let p = pos
  while (p < text.length && /\s/.test(text[p])) p++
  const rest = text.slice(p)
  const maxLen = Math.min(MAX_ALIAS_LEN, rest.length)
  for (let len = maxLen; len >= 1; len--) {
    const hit = ALIASES[rest.slice(0, len)]
    if (hit) return hit
  }
  return null
}

/** 切分输入文本为数值片段数组；纯文本（连接词等）被忽略 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const re = new RegExp(TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    const symbol = m[1] ?? undefined
    const sign = m[2] === '-' ? -1 : 1

    let value: number
    let isComposite = false
    if (m[4] !== undefined && m[5] !== undefined) {
      // 复合：5'9" → 5 英尺 9 英寸 = 69 英寸
      value = sign * (Number(m[4]) * 12 + Number(m[5]))
      isComposite = true
    } else if (m[6] !== undefined) {
      const [a, b] = m[6].split('/').map((s) => Number(s.trim()))
      value = b === 0 ? NaN : sign * (a / b)
    } else if (m[7] !== undefined) {
      value = sign * Number(m[7])
    } else {
      value = sign * Number((m[8] ?? '').replace(/,/g, ''))
    }
    if (!Number.isFinite(value)) continue

    let unit: string | undefined
    let dim: Dim | undefined
    let error: string | undefined

    if (symbol) {
      unit = SYMBOL_TO_CURRENCY[symbol] ?? symbol
      dim = 'currency'
    } else if (isComposite) {
      unit = 'in'
      dim = 'length'
    } else {
      const hit = matchUnitAt(input, re.lastIndex)
      if (hit) {
        unit = hit.canonical
        dim = hit.dim
      } else {
        let p = re.lastIndex
        while (p < input.length && /\s/.test(input[p])) p++
        const c = input[p]
        if (c !== undefined && /[A-Za-zμµ°]/.test(c)) {
          error = '无法识别单位'
        } else if (c === '.' && /[0-9]/.test(input[p + 1] ?? '')) {
          error = '数字格式异常'
        }
      }
    }

    tokens.push({ raw: m[0], value, unit, dim, symbol, error })
  }
  return tokens
}

// findUnit 仅用于后续量纲换算时的取用，此处显式引用避免未使用告警
void findUnit
```

> 说明：末尾 `void findUnit` 是为满足 `noUnusedLocals` 的临时兜底——Task 4 的 `convert.ts` 会真正使用 `findUnit`。若 `vue-tsc` 仍报未使用，可先删除该行、在 Task 4 完成后再运行 `npm run build`。

- [ ] **Step 2: 创建 `scripts/verify-units.ts`（词法部分），写入以下完整内容**

```ts
// 单位换算核心逻辑自检脚本（设计文档约定的验证方式，非单元测试框架）
// 运行：node scripts/verify-units.ts
import { tokenize } from '../src/lib/units/lexer.ts'

let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!cond) failed++
}
function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(b))
}

function single(text: string) {
  const t = tokenize(text)
  if (t.length !== 1) {
    throw new Error(`期望 1 个片段，实际 ${t.length}：${JSON.stringify(t)}`)
  }
  return t[0]
}

console.log('词法')
const t30 = single('30kg')
check('30kg → 数值 30', t30.value === 30)
check('30kg → 单位 kg', t30.unit === 'kg')
check('30kg → 量纲 weight', t30.dim === 'weight')

const tDollar = single('$1.99')
check('$1.99 → 数值 1.99', tDollar.value === 1.99)
check('$1.99 → 币种 USD', tDollar.unit === 'USD')
check('$1.99 → 量纲 currency', tDollar.dim === 'currency')

const tH = single('2h')
check('2h → 单位 h / time', tH.unit === 'h' && tH.dim === 'time')

const tComp = single("5'9\"")
check("5'9\" → 69 in", tComp.value === 69 && tComp.unit === 'in' && tComp.dim === 'length', String(tComp.value))

const tFrac = single('1/2')
check('1/2 → 0.5', near(tFrac.value ?? 0, 0.5))

const tThou = single('1,000')
check('1,000 → 1000', tThou.value === 1000)

const tSci = single('1e3')
check('1e3 → 1000', tSci.value === 1000)

const tNeg = single('-5℃')
check('-5℃ → 数值 -5 / 温度 ℃', tNeg.value === -5 && tNeg.unit === '℃' && tNeg.dim === 'temperature')

const tBare = single('42')
check('42 无单位', tBare.value === 42 && tBare.unit === undefined)

const tSpace = single('30 kg')
check('30 kg（带空格）→ kg', tSpace.unit === 'kg')

const tPost = single('100 CNY')
check('100 CNY（后置词）→ currency', tPost.unit === 'CNY' && tPost.dim === 'currency')

const err = tokenize('1.2.3').find((t) => t.error)
check('1.2.3 → 无法识别', Boolean(err), err?.error)

const multi = tokenize('30kg 和 $1.99')
check('多片段 30kg 和 $1.99 → 2 段', multi.length === 2 && multi[0].dim === 'weight' && multi[1].dim === 'currency', String(multi.length))

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
```

- [ ] **Step 3: 运行自检**

```bash
node scripts/verify-units.ts
```

Expected: 所有词法断言 `✓`，结尾输出 `全部通过`，退出码 0。

- [ ] **Step 4: 提交**

```bash
git add src/lib/units/registry.ts src/lib/units/lexer.ts scripts/verify-units.ts
git commit -m "feat: 单位换算核心注册表与词法引擎"
```

---

### Task 4: 量纲换算 `convert.ts` + 自检（量纲部分）

**Files:**
- Create: `src/lib/units/convert.ts`
- Modify: `scripts/verify-units.ts`（追加量纲断言）

- [ ] **Step 1: 创建 `src/lib/units/convert.ts`，写入以下完整内容**

```ts
// 量纲内换算：单值 → 该量纲全部等价项；温度/货币特殊处理
import { DIM_LABEL, findUnit, UNITS, type Dim } from './registry.ts'
import { equivalentCurrencies, currencyName, hasRate, type Rates } from './money.ts'

export interface Equivalent {
  unit: string
  name: string
  value: number
  approx?: boolean
  /** 货币无汇率数据时置位 */
  noRate?: boolean
}

export interface EquivResult {
  dim: Dim
  dimLabel: string
  sourceUnit: string
  sourceName: string
  equivalents: Equivalent[]
  /** 附加说明：基于公式换算 / 近似 / 无汇率数据 */
  note?: string
}

/** 数值展示：极端大/小用科学计数，其余保留至多 6 位有效数字 */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return v.toExponential(1)
  return String(Number(v.toPrecision(6)))
}

/** 片段 → 该量纲全部等价项；无单位/量纲/无法换算返回 null */
export function equivalentsFor(
  tok: { value?: number; unit?: string; dim?: Dim },
  rates?: Rates | null,
): EquivResult | null {
  if (tok.dim === undefined || tok.unit === undefined || tok.value === undefined) return null

  if (tok.dim === 'currency') {
    const list = equivalentCurrencies(tok.value, tok.unit, rates ?? null)
    return {
      dim: 'currency',
      dimLabel: DIM_LABEL.currency,
      sourceUnit: tok.unit,
      sourceName: currencyName(tok.unit),
      equivalents: list,
      note: hasRate(tok.unit, rates) ? undefined : '无汇率数据',
    }
  }

  if (tok.dim === 'temperature') {
    const u = findUnit('temperature', tok.unit)
    if (!u?.toBase || !u.fromBase) return null
    const base = u.toBase(tok.value)
    return {
      dim: 'temperature',
      dimLabel: DIM_LABEL.temperature,
      sourceUnit: tok.unit,
      sourceName: u.name,
      equivalents: UNITS.temperature
        .filter((x) => x.canonical !== tok.unit)
        .map((x) => ({ unit: x.canonical, name: x.name, value: x.fromBase!(base) })),
      note: '基于公式换算',
    }
  }

  const u = findUnit(tok.dim, tok.unit)
  if (!u || u.factor === undefined) return null
  const base = tok.value * u.factor
  return {
    dim: tok.dim,
    dimLabel: DIM_LABEL[tok.dim],
    sourceUnit: tok.unit,
    sourceName: u.name,
    equivalents: UNITS[tok.dim]
      .filter((x) => x.canonical !== tok.unit)
      .map((x) => ({
        unit: x.canonical,
        name: x.name,
        value: x.factor === undefined ? 0 : base / x.factor,
        approx: x.approx,
      })),
  }
}
```

- [ ] **Step 2: 追加量纲断言到 `scripts/verify-units.ts`**

在 `scripts/verify-units.ts` 的 `import { tokenize } from '../src/lib/units/lexer.ts'` 行之后追加一行导入：

```ts
import { equivalentsFor, formatValue } from '../src/lib/units/convert.ts'
```

并在 `console.log(failed === 0 ? '\n全部通过' : ...)` 那一行**之前**插入以下区块：

```ts
console.log('量纲换算')
const mi = equivalentsFor(single('1 mi'))!
check('1 mi → 1609.344 m', near(mi.equivalents.find((e) => e.unit === 'm')?.value ?? 0, 1609.344))
check('1 mi 量纲 length', mi.dim === 'length')

const jin = equivalentsFor(single('1 斤'))!
check('1 斤 → 500 g', near(jin.equivalents.find((e) => e.unit === 'g')?.value ?? 0, 500))
check('1 斤 → 0.5 kg', near(jin.equivalents.find((e) => e.unit === 'kg')?.value ?? 0, 0.5))

const gb = equivalentsFor(single('1 GB'))!
check('1 GB → 1000 MB', near(gb.equivalents.find((e) => e.unit === 'MB')?.value ?? 0, 1000))
check('1 GB → 1e9 B', near(gb.equivalents.find((e) => e.unit === 'B')?.value ?? 0, 1e9))

console.log('温度（基于公式换算）')
const c = equivalentsFor(single('100℃'))!
check('100℃ → 212℉', near(c.equivalents.find((e) => e.unit === '℉')?.value ?? 0, 212))
check('100℃ → 373.15K', near(c.equivalents.find((e) => e.unit === 'K')?.value ?? 0, 373.15))
check('100℃ 标注基于公式换算', c.note === '基于公式换算')
const f = equivalentsFor(single('212℉'))!
check('212℉ round-trip → 100℃', near(f.equivalents.find((e) => e.unit === '℃')?.value ?? 0, 100))

console.log('面积 / 体积 / 时间')
const mu = equivalentsFor(single('1 亩'))!
check('1 亩 → 666.67 ㎡', near(mu.equivalents.find((e) => e.unit === '㎡')?.value ?? 0, 2000 / 3))
const gal = equivalentsFor(single('1 gal'))!
check('1 gal → 3.7854 L', near(gal.equivalents.find((e) => e.unit === 'L')?.value ?? 0, 3.785411784))
const wk = equivalentsFor(single('1 week'))!
check('1 week → 7 day', near(wk.equivalents.find((e) => e.unit === 'day')?.value ?? 0, 7))
check('1 week → 604800 s', near(wk.equivalents.find((e) => e.unit === 's')?.value ?? 0, 604800))

console.log('数值展示')
check('formatValue(3e8) → 3.0e+8', formatValue(3e8) === '3.0e+8', formatValue(3e8))
check('formatValue(1000) → 1000', formatValue(1000) === '1000')
check('formatValue(1/3) → 0.333333', formatValue(1 / 3) === '0.333333', formatValue(1 / 3))
```

- [ ] **Step 3: 运行自检**

```bash
node scripts/verify-units.ts
```

Expected: 词法 + 量纲 + 数值展示全部 `✓`，`全部通过`，退出码 0。

> 说明：此时 `convert.ts` 引用了尚未创建的 `money.ts`，Node 运行会因找不到模块失败。若发生，先执行 Task 5 再回到本步运行（Task 5 会创建 `money.ts`）。**请按顺序先做 Task 5 再运行本步验证。**

---

### Task 5: 货币换算 `money.ts` + 自检（货币部分）

**Files:**
- Create: `src/lib/units/money.ts`
- Modify: `scripts/verify-units.ts`（追加货币断言）

- [ ] **Step 1: 创建 `src/lib/units/money.ts`，写入以下完整内容**

```ts
// 货币：符号/代码识别对照 + 快照汇率换算（纯函数，汇率以 USD 为基准）
export interface Rates {
  base: string
  _source?: string
  _updatedAt?: string
  _fetchedAt?: number
  rates: Record<string, number>
}

export interface CurrencyInfo {
  code: string
  name: string
}

/** 结果卡片默认列出的常用币种（避免 160 行刷屏） */
export const COMMON_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: '美元' },
  { code: 'CNY', name: '人民币' },
  { code: 'EUR', name: '欧元' },
  { code: 'GBP', name: '英镑' },
  { code: 'JPY', name: '日元' },
  { code: 'HKD', name: '港币' },
  { code: 'AUD', name: '澳元' },
  { code: 'CAD', name: '加元' },
  { code: 'SGD', name: '新加坡元' },
  { code: 'CHF', name: '瑞士法郎' },
]

/** 符号 → 币种对照表（藏于顶栏帮助 tooltip） */
export const CURRENCY_SYMBOLS: Array<{ symbols: string; name: string; code: string }> = [
  { symbols: '$ / US$ / USD', name: '美元', code: 'USD' },
  { symbols: '¥ / CN¥ / CNY', name: '人民币', code: 'CNY' },
  { symbols: '€ / EUR', name: '欧元', code: 'EUR' },
  { symbols: '£ / GBP', name: '英镑', code: 'GBP' },
  { symbols: 'JP¥ / 円 / JPY', name: '日元', code: 'JPY' },
  { symbols: 'HK$ / HKD', name: '港币', code: 'HKD' },
  { symbols: 'A$ / AUD', name: '澳元', code: 'AUD' },
  { symbols: 'C$ / CAD', name: '加元', code: 'CAD' },
  { symbols: 'S$ / SGD', name: '新加坡元', code: 'SGD' },
  { symbols: 'CHF', name: '瑞士法郎', code: 'CHF' },
]

export function currencyName(code: string): string {
  return COMMON_CURRENCIES.find((c) => c.code === code)?.name ?? code
}

export function hasRate(code: string, rates?: Rates | null): boolean {
  if (!rates) return false
  const r = rates.rates[code]
  return typeof r === 'number' && r > 0
}

/** 币种数值 → USD：1 USD = rates[code] 币，故 valueUsd = value / rates[code] */
export function toUsd(value: number, code: string, rates: Rates): number | null {
  const r = rates.rates[code]
  if (typeof r !== 'number' || r <= 0) return null
  return value / r
}

/** USD → 任意币种 */
export function fromUsd(usd: number, code: string, rates: Rates): number | null {
  const r = rates.rates[code]
  if (typeof r !== 'number' || r <= 0) return null
  return usd * r
}

export interface MoneyEquivalent {
  unit: string
  name: string
  value: number
  noRate?: boolean
}

/** 列常用币种等价项；无快照或缺数据 → 全部标注 noRate（value 置 0，前端显示「无汇率数据」） */
export function equivalentCurrencies(
  value: number,
  from: string,
  rates: Rates | null,
): MoneyEquivalent[] {
  const markAllNoRate = (): MoneyEquivalent[] =>
    COMMON_CURRENCIES.map((c) => ({ unit: c.code, name: c.name, value: 0, noRate: true }))

  if (!rates) return markAllNoRate()
  const usd = toUsd(value, from, rates)
  if (usd === null) return markAllNoRate()
  return COMMON_CURRENCIES.filter((c) => c.code !== from).map((c) => {
    const v = fromUsd(usd, c.code, rates)
    return { unit: c.code, name: c.name, value: v === null ? 0 : v, noRate: v === null }
  })
}
```

- [ ] **Step 2: 追加货币断言到 `scripts/verify-units.ts`**

在 `scripts/verify-units.ts` 的导入区追加（`formatValue` 那行之后）：

```ts
import { equivalentCurrencies, type Rates } from '../src/lib/units/money.ts'
```

在文件顶部（`import` 之后）追加快照读取（任务 6 之前 `rates.json` 不存在则静默跳过）：

```ts
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let rates: Rates | null = null
try {
  rates = JSON.parse(readFileSync(join(here, '../src/data/rates.json'), 'utf8')) as Rates
} catch {
  // 允许缺快照：货币快照断言会跳过
}
```

并在 `console.log(failed === 0 ? '\n全部通过' : ...)` 之前插入以下区块：

```ts
console.log('货币')
if (rates) {
  const usdTok = single('$1.99')
  const usdEq = equivalentsFor(usdTok, rates)!
  const cny = usdEq.equivalents.find((e) => e.unit === 'CNY')
  check('$1.99 → CNY 用快照汇率', Boolean(cny && near(cny.value, 1.99 * (rates.rates.CNY ?? 0))), String(cny?.value))

  const y100 = single('¥100')
  check('¥100 → 币种 CNY', y100.unit === 'CNY' && y100.dim === 'currency')
  const yEq = equivalentsFor(y100, rates)!
  const usd = yEq.equivalents.find((e) => e.unit === 'USD')
  check('¥100 → USD 用快照汇率', Boolean(usd && near(usd.value, 100 / (rates.rates.CNY ?? 1))), String(usd?.value))

  const jpy100 = single('JP¥100')
  check('JP¥100 → 币种 JPY', jpy100.unit === 'JPY' && jpy100.dim === 'currency')
  const jpEq = equivalentsFor(jpy100, rates)!
  const usd2 = jpEq.equivalents.find((e) => e.unit === 'USD')
  check('JP¥100 → USD 用快照汇率', Boolean(usd2 && near(usd2.value, 100 / (rates.rates.JPY ?? 1))), String(usd2?.value))
} else {
  console.log('  ⚠ 无 rates.json，跳过货币快照断言（Task 6 后再跑）')
}

console.log('货币：无汇率数据标注')
const noRates = equivalentCurrencies(7, 'CNY', null)
check('无快照 → 全部标注无汇率数据', noRates.length === 10 && noRates.every((e) => e.noRate === true))
const partial: Rates = { base: 'USD', rates: { USD: 1, CNY: 7 } }
const withMissing = equivalentCurrencies(7, 'CNY', partial)
check('缺 JPY 数据 → JPY 标注无汇率数据', Boolean(withMissing.find((e) => e.unit === 'JPY')?.noRate))
const usdItem = withMissing.find((e) => e.unit === 'USD')
check('有 USD 数据 → 正常换算 1 USD', Boolean(usdItem && near(usdItem.value, 1)), String(usdItem?.value))
```

- [ ] **Step 3: 运行自检**

```bash
node scripts/verify-units.ts
```

Expected: 全部 `✓`（货币快照断言此时因无 `rates.json` 走 `⚠ 跳过` 分支），`全部通过`，退出码 0。

- [ ] **Step 4: 提交**

```bash
git add src/lib/units/convert.ts src/lib/units/money.ts scripts/verify-units.ts
git commit -m "feat: 单位换算与货币换算核心逻辑"
```

---

### Task 6: 汇率快照 + 数据链（rates.json / idb.ts / rates.ts / update-rates.ts）

**Files:**
- Create: `src/data/rates.json`（由脚本抓取生成）
- Create: `src/lib/units/idb.ts`
- Create: `src/lib/units/rates.ts`
- Create: `scripts/update-rates.ts`

- [ ] **Step 1: 创建 `scripts/update-rates.ts`**

```ts
// 开发期重抓汇率快照覆盖 src/data/rates.json（在线源 open.er-api.com，免 key、CORS 开放）
// 运行：node scripts/update-rates.ts
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://open.er-api.com/v6/latest/USD'
const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../src/data/rates.json')

async function main(): Promise<void> {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as {
    result?: string
    time_last_update_utc?: string
    base_code?: string
    rates?: Record<string, number>
  }
  if (data.result !== 'success' || !data.rates || !data.base_code) throw new Error('响应格式异常')
  const snapshot = {
    _source: URL,
    _updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
    base: data.base_code,
    rates: data.rates,
  }
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`已写入 ${OUT}：${data.base_code} 基准，${Object.keys(data.rates).length} 种币种`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: 运行脚本生成 `src/data/rates.json`**

```bash
node scripts/update-rates.ts
```

Expected: 输出 `已写入 …/src/data/rates.json：USD 基准，1xx 种币种`（约 160 种）。

> 若沙箱此时无网络（fetch 失败）：手写最小快照 `src/data/rates.json`，内容为：
> ```json
> {
>   "_source": "https://open.er-api.com/v6/latest/USD",
>   "_updatedAt": "2026-08-22",
>   "base": "USD",
>   "rates": { "USD": 1, "CNY": 7.1, "EUR": 0.92, "GBP": 0.79, "JPY": 155, "HKD": 7.8, "AUD": 1.5, "CAD": 1.36, "SGD": 1.34, "CHF": 0.88 }
> }
> ```
> 并在计划执行说明里注明「内置快照为手工最小值」。

- [ ] **Step 3: 创建 `src/lib/units/idb.ts`**

```ts
// 极简 IndexedDB 封装：存汇率快照（key units:rates，TTL 24h）
import type { Rates } from './money.ts'

const DB_NAME = 'anypctoolbox'
const DB_VERSION = 1
const STORE = 'kv'
const KEY = 'units:rates'
const TTL_MS = 24 * 60 * 60 * 1000

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读缓存汇率：存在且未超 TTL 才返回；任何异常静默返回 null */
export async function readCachedRates(): Promise<Rates | null> {
  try {
    const v = await idbGet<Rates>(KEY)
    if (!v || typeof v._fetchedAt !== 'number') return null
    if (Date.now() - v._fetchedAt > TTL_MS) return null
    return v
  } catch {
    return null
  }
}

/** 写缓存汇率（带抓取时间戳）；失败静默 */
export async function writeCachedRates(rates: Rates): Promise<void> {
  try {
    await idbSet(KEY, { ...rates, _fetchedAt: Date.now() })
  } catch {
    // 静默
  }
}
```

- [ ] **Step 4: 创建 `src/lib/units/rates.ts`**

```ts
// 汇率数据链（stale-while-revalidate）：内置快照 → indexedDB 缓存(24h) → 在线刷新
import builtinRatesJson from '@/data/rates.json'
import type { Rates } from '@/lib/units/money'
import { readCachedRates, writeCachedRates } from '@/lib/units/idb'

export type RateSource = '内置快照' | '本地缓存' | '在线更新'

export interface RateState {
  rates: Rates
  source: RateSource
}

const ONLINE_URL = 'https://open.er-api.com/v6/latest/USD'
const FETCH_TIMEOUT_MS = 8000

const builtin = builtinRatesJson as unknown as Rates

type Listener = (s: RateState) => void
const listeners: Listener[] = []

function emit(s: RateState): void {
  for (const l of listeners) l(s)
}

/** 订阅汇率更新（在线刷新成功后触发）；返回取消订阅函数 */
export function onRatesUpdate(cb: Listener): () => void {
  listeners.push(cb)
  return () => {
    const i = listeners.indexOf(cb)
    if (i >= 0) listeners.splice(i, 1)
  }
}

/** 立即返回当前最优数据：缓存优先，否则内置快照 */
export async function loadInitialRates(): Promise<RateState> {
  const cached = await readCachedRates()
  if (cached) return { rates: cached, source: '本地缓存' }
  return { rates: builtin, source: '内置快照' }
}

/** 后台在线拉取：成功后写缓存并广播；失败静默 */
export async function refreshRatesOnline(): Promise<void> {
  const fetched = await fetchOnlineRates()
  if (!fetched) return
  await writeCachedRates(fetched)
  emit({ rates: fetched, source: '在线更新' })
}

async function fetchOnlineRates(): Promise<Rates | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(ONLINE_URL, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as {
      result?: string
      time_last_update_utc?: string
      base_code?: string
      rates?: Record<string, number>
    }
    if (data.result !== 'success' || !data.rates || !data.base_code) return null
    return {
      base: data.base_code,
      _source: ONLINE_URL,
      _updatedAt: data.time_last_update_utc ?? '',
      _fetchedAt: Date.now(),
      rates: data.rates,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 5: 重新运行自检（此时 rates.json 已存在，货币快照断言生效）**

```bash
node scripts/verify-units.ts
```

Expected: 所有断言 `✓`（含 `$1.99 → CNY 用快照汇率` 等），`全部通过`，退出码 0。

- [ ] **Step 6: 提交**

```bash
git add src/data/rates.json src/lib/units/idb.ts src/lib/units/rates.ts scripts/update-rates.ts
git commit -m "feat: 汇率快照与 stale-while-revalidate 数据链"
```

---

### Task 7: 页面 `Units.vue`

**Files:**
- Create: `src/views/Units.vue`

- [ ] **Step 1: 创建 `src/views/Units.vue`，写入以下完整内容**

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useToaster } from '@/lib/ui/use-toast'
import { Tooltip, TooltipContent, TooltipPortal, TooltipProvider, TooltipTrigger } from 'radix-vue'
import { tokenize, type Token } from '@/lib/units/lexer'
import { equivalentsFor, formatValue, type EquivResult } from '@/lib/units/convert'
import { COMMON_CURRENCIES, CURRENCY_SYMBOLS } from '@/lib/units/money'
import { DIMS, UNITS, type Dim } from '@/lib/units/registry'
import { loadInitialRates, onRatesUpdate, refreshRatesOnline, type RateState } from '@/lib/units/rates'

const router = useRouter()
const { toast } = useToaster()

const input = ref('')
const tokens = ref<Token[]>([])
const rateState = ref<RateState | null>(null)

// ---- 结果 ----
interface Entry {
  token: Token
  result: EquivResult | null
}
const entries = computed<Entry[]>(() =>
  tokens.value.map((token) => ({ token, result: equivalentsFor(token, rateState.value?.rates ?? null) })),
)
const recognizedCount = computed(() => tokens.value.filter((t) => t.dim !== undefined).length)
const unrecognizedCount = computed(() => tokens.value.length - recognizedCount.value)

// ---- 手动换算 ----
const showManual = ref(false)
const manualDim = ref<Dim>('length')
const manualFrom = ref('')
const manualTo = ref('')
const manualValue = ref('')
const manualResult = ref<string | null>(null)
const PREFS_KEY = 'units:pref'

function unitsOf(dim: Dim): Array<{ code: string; name: string }> {
  if (dim === 'currency') return COMMON_CURRENCIES
  return UNITS[dim].map((u) => ({ code: u.canonical, name: u.name }))
}

function syncManualUnits(): void {
  const list = unitsOf(manualDim.value)
  if (!list.some((u) => u.code === manualFrom.value)) manualFrom.value = list[0]?.code ?? ''
  if (!list.some((u) => u.code === manualTo.value)) manualTo.value = list[1]?.code ?? list[0]?.code ?? ''
}

function loadPrefs(): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const p = JSON.parse(raw) as { dim?: Dim; from?: string; to?: string }
    if (p.dim && DIMS.some((d) => d.id === p.dim)) manualDim.value = p.dim
    if (typeof p.from === 'string') manualFrom.value = p.from
    if (typeof p.to === 'string') manualTo.value = p.to
  } catch {
    // 解析失败 → 默认偏好
  }
  syncManualUnits()
}

function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ dim: manualDim.value, from: manualFrom.value, to: manualTo.value }))
  } catch {
    // 存储失败静默
  }
}

watch([manualDim, manualFrom, manualTo], () => {
  syncManualUnits()
  savePrefs()
})

function handleManualConvert(): void {
  const raw = manualValue.value.trim()
  const v = Number(raw)
  if (!raw || Number.isNaN(v)) {
    manualResult.value = null
    toast(undefined, '请输入数值')
    return
  }
  if (!manualFrom.value || !manualTo.value) {
    manualResult.value = null
    toast(undefined, '请选择源单位与目标单位')
    return
  }
  const tok: Token = { raw: `${v} ${manualFrom.value}`, value: v, unit: manualFrom.value, dim: manualDim.value }
  const res = equivalentsFor(tok, rateState.value?.rates ?? null)
  const eq = res?.equivalents.find((e) => e.unit === manualTo.value)
  if (!eq) {
    manualResult.value = null
    toast(undefined, '该量纲不支持此换算')
    return
  }
  manualResult.value = formatValue(eq.value)
}

// ---- 主换算 ----
function handleConvert(): void {
  tokens.value = tokenize(input.value)
  const n = tokens.value.length
  if (n === 0) {
    toast(undefined, '未识别到数值，请输入如 30kg 或 $1.99')
    return
  }
  if (unrecognizedCount.value === n) toast(undefined, `无法识别 ${n} 个片段`)
}

async function copyValue(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast(undefined, `已复制 ${text}`)
  } catch {
    toast(undefined, '复制失败')
  }
}

// ---- 汇率链 ----
let offRates: (() => void) | null = null
onMounted(() => {
  void loadInitialRates().then((s) => {
    rateState.value = s
  })
  offRates = onRatesUpdate((s) => {
    rateState.value = s
  })
  void refreshRatesOnline()
})
onBeforeUnmount(() => {
  offRates?.()
})

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

loadPrefs()
</script>

<template>
  <div class="space-y-6">
    <!-- 顶栏 -->
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">单位换算</h2>
      <div class="ml-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-input text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
              >
                ?
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="bottom"
                align="end"
                class="z-50 max-w-xs rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-lg"
              >
                <p class="mb-2 font-medium">货币符号对照表</p>
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-muted-foreground">
                      <th class="pb-1 text-left font-normal">符号</th>
                      <th class="pb-1 text-left font-normal">币种</th>
                      <th class="pb-1 text-left font-normal">代码</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in CURRENCY_SYMBOLS" :key="c.code" class="border-t border-border/50">
                      <td class="py-0.5 pr-2 font-mono">{{ c.symbols }}</td>
                      <td class="py-0.5 pr-2">{{ c.name }}</td>
                      <td class="py-0.5 font-mono">{{ c.code }}</td>
                    </tr>
                  </tbody>
                </table>
              </TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="mx-auto max-w-2xl pt-2">
      <div class="relative">
        <input
          v-model="input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="如 30kg 和 $1.99，回车换算"
          class="block w-full rounded-2xl bg-accent/60 py-3 pl-4 pr-24 text-sm font-mono outline-none placeholder:text-muted-foreground focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter.prevent="handleConvert"
        />
        <button
          class="absolute bottom-2 right-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          @click="handleConvert"
        >
          换算
        </button>
      </div>
      <p class="mt-2 text-center text-xs text-muted-foreground">支持多个片段，如 "30kg 和 $1.99"</p>
    </div>

    <!-- 结果区 -->
    <div v-if="entries.length" class="space-y-4">
      <div v-for="(e, i) in entries" :key="i" class="rounded-lg border">
        <div class="flex items-center gap-2 border-b px-3 py-2">
          <span class="text-sm font-semibold"
            >片段：{{ e.token.raw }}<template v-if="e.token.unit"> {{ e.token.unit }}</template></span
          >
          <span
            v-if="e.result"
            class="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
            >{{ e.result.dimLabel }}</span
          >
          <span v-if="e.token.symbol" class="ml-auto rounded px-1.5 py-0.5 text-xs text-muted-foreground"
            >{{ e.token.symbol }} 前置符号</span
          >
        </div>

        <div v-if="e.token.error" class="px-4 py-3 text-sm text-muted-foreground">
          ⚠️ 无法识别片段：{{ e.token.error }}
        </div>
        <div v-else-if="!e.token.unit" class="px-4 py-3 text-sm text-muted-foreground">
          未识别到单位：{{ e.token.value }}
        </div>
        <div v-else-if="!e.result" class="px-4 py-3 text-sm text-muted-foreground">
          暂不支持该量纲换算
        </div>
        <ul v-else class="divide-y">
          <li v-for="eq in e.result.equivalents" :key="eq.unit" class="flex items-center gap-2 px-4 py-2 text-sm">
            <span class="w-40 shrink-0 text-muted-foreground">{{ eq.name }}（{{ eq.unit }}）</span>
            <span v-if="eq.noRate" class="text-muted-foreground">无汇率数据</span>
            <span v-else class="font-mono">{{ formatValue(eq.value) }}</span>
            <span v-if="eq.approx" class="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">近似</span>
            <button
              v-if="!eq.noRate"
              class="ml-auto shrink-0 rounded px-2 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              @click="copyValue(formatValue(eq.value))"
            >
              复制
            </button>
          </li>
        </ul>
        <div v-if="e.result?.note" class="border-t px-4 py-2 text-xs text-muted-foreground">
          {{ e.result.note }}
        </div>
      </div>
    </div>
    <div v-else-if="input && tokens.length === 0" class="py-8 text-center text-sm text-muted-foreground">
      未识别到数值片段
    </div>

    <!-- 手动选择表（折叠，默认收起） -->
    <div class="rounded-lg border">
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="showManual = !showManual"
      >
        手动选择换算
        <span class="text-muted-foreground">{{ showManual ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showManual" class="space-y-3 border-t px-4 py-4 text-sm">
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">量纲</span>
            <select
              v-model="manualDim"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="d in DIMS" :key="d.id" :value="d.id">{{ d.label }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">源单位</span>
            <select
              v-model="manualFrom"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="u in unitsOf(manualDim)" :key="u.code" :value="u.code">{{ u.name }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-muted-foreground">目标</span>
            <select
              v-model="manualTo"
              class="h-8 flex-1 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option v-for="u in unitsOf(manualDim)" :key="u.code" :value="u.code">{{ u.name }}</option>
            </select>
          </label>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="manualValue"
            type="text"
            inputmode="decimal"
            spellcheck="false"
            placeholder="数值"
            class="h-8 w-32 rounded-md border border-input bg-background px-2 font-mono outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            @keydown.enter.prevent="handleManualConvert"
          />
          <span class="text-muted-foreground">=</span>
          <span v-if="manualResult !== null" class="font-mono text-primary">{{ manualResult }} {{ manualTo }}</span>
          <span v-else class="text-muted-foreground">—</span>
          <button
            class="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            @click="handleManualConvert"
          >
            换算
          </button>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="rateState"
        >汇率：{{ rateState.source
        }}<template v-if="formatDate(rateState.rates._updatedAt)"> · {{ formatDate(rateState.rates._updatedAt) }}</template></span
      >
      <span v-else>汇率加载中…</span>
      <span>识别 {{ recognizedCount }} 段 · 无法识别 {{ unrecognizedCount }} 段</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 类型检查页面**

```bash
npx vue-tsc --noEmit
```

Expected: 无类型错误（`src/` 全部通过）。若报 radix-vue 相关错误，确认 Task 1 已安装；若报 `findUnit` 未使用（`lexer.ts` 兜底 `void findUnit`），将其改为 `export { findUnit } from './registry.ts'` 重导出即可。

---

### Task 8: 路由与首页入口

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/views/Home.vue`

- [ ] **Step 1: 注册 `/units` 路由**

在 `src/router/index.ts` 的 `/rename` 路由条目之后（`routes` 数组末尾）插入：

```ts
    {
      path: '/units',
      name: 'units',
      component: () => import('@/views/Units.vue'),
    },
```

- [ ] **Step 2: 首页增加工具卡片**

在 `src/views/Home.vue` 的 `tools` 数组末尾（`/rename` 条目之后）插入：

```ts
  {
    icon: '🧮',
    name: '单位换算',
    description: "输入 30kg、$1.99、5'9\" 等片段，自动识别并列出全部等价单位",
    route: '/units',
    tag: 'v1.0',
  },
```

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

Expected: `vue-tsc --noEmit` 通过，`vite build` 成功产出 `dist/`。

- [ ] **Step 4: 提交**

```bash
git add src/router/index.ts src/views/Home.vue src/views/Units.vue
git commit -m "feat: 新增单位换算工具页面与入口"
```

---

### Task 9: 最终验证与提交

- [ ] **Step 1: 全量自检**

```bash
node scripts/verify-units.ts && npm run build
```

Expected: 自检 `全部通过`（退出码 0），构建成功。

- [ ] **Step 2: 手动冒烟（可选，起 dev server 验证页面交互）**

```bash
npm run dev
```

浏览器打开提示的地址，进入 `/units`：输入 `30kg 和 $1.99` 回车，应显示两张卡片（重量 + 货币）；悬停顶栏 `?` 出现符号对照表；展开手动表可换算任意量纲；底部状态栏展示汇率来源。验证后 `Ctrl+C` 停止。

- [ ] **Step 3: 检查工作区无残留改动**

```bash
git status --short
```

Expected: 无未提交改动（或仅有 Task 9 新增的无意改动，酌情提交）。

---

## 自检（plan 层面）

- **Spec 覆盖**：8 量纲与单位（registry）✓；词法（lexer，含 `5'9"`/`1/2`/`1,000`/`1e3`/`-5℃`/无法识别）✓；等价列表 + 温度公式 + 手动选择表（convert + Units.vue）✓；货币符号表 tooltip + 10 常用币种 + 无汇率标注（money + Units.vue）✓；stale-while-revalidate 数据链（rates.ts + idb.ts + rates.json）✓；路由 `/units` 与首页卡片 ✓；底部状态栏（汇率来源 + 识别统计）✓；不持久化输入 ✓；`scripts/verify-units.ts` 覆盖设计文档「测试」节全部关键样例 ✓。
- **占位符扫描**：全部步骤含完整代码与预期输出，无 TBD/TODO。
- **类型一致性**：`Token`（lexer）→ `equivalentsFor` 入参（convert）→ `EquivResult`（Units.vue）字段名一致；`Rates` 由 money.ts 定义、idb/rates/verify 复用；`ALIASES`/`UNITS`/`findUnit`/`DIMS`/`DIM_LABEL` 命名在 registry 与消费方一致。
