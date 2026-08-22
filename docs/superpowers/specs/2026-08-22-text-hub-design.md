# 文本处理中台（Text Hub）设计

日期：2026-08-22
状态：已确认
路由：`/text-hub`

## 定位

用户只输入一段文本，不切换页面，一次性产出所有与这段文本相关的处理结果。核心哲学是「一次输入、全部产出」，而非「先挑算法再输入」。

多输出 Tab 框架是整套工具箱的「文本入口」。框架搭好后，后续新增任意算法只需在注册表侧再挂一个子项，边际成本极低。

## 目标用户

- 开发者：快速编解码、算哈希、看统计、识别时间戳。
- 普通用户/测试：粘贴 JSON/URL/Base64 想一键看清里面是什么。
- 运维/分析：对文本反复做多轮解码探测。

## 页面布局（遵循 docs/superpowers/specs/2026-08-18-tool-dev-convention.md）

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回 | 文本处理中台                     [复制输入][清空]     │
├──────────────────────────────┬──────────────────────────────┤
│  输入区（多行 textarea）       │  [编解码] [哈希] [统计]      │
│   · 自动类型探测徽标          │  [时间戳] [智能解码] (垂直 Tab)│
│   · Ctrl+Enter 可刷新         │  ─────────────────────────   │
│                              │  结果子面板                    │
│                              │  · 每子项有 [复制][下载]        │
└──────────────────────────────┴──────────────────────────────┘
   底栏：字符数 · 行数 · 字节数（UTF-8) · 已识别类型
```

- 左窄右宽的 `grid md:grid-cols-[1fr,1.6fr]`，移动端上下堆叠。
- 右侧顶部是**算法大类**的垂直 Tab 组，点击某一类后，其下再展开**该类的具体子项**。

## 交互流程

1. 用户粘贴/输入文本。
2. 左侧自动检测类型（JSON / URL / Base64 / UUID / 时间戳 / 十六进制 / 通用文本），输入框顶部给轻量徽标（不阻断输入）。
3. 右侧默认落在「编解码」类，各算法子项即时渲染结果。
4. 点任一 Tab 结果即时刷新；每项结果旁有 `复制` 与 `下载`。
5. 输入被清空或全空格时，结果区显示空态占位。

## 架构与数据流（方案 A：注册表驱动）

核心是**注册表驱动**：输入文本在 `TextHub.vue` 持有；每个算法大类 → 一组子项，每个子项 = 一个纯函数模块 + 一个面板组件。新增算法只需往注册表挂一项。

```
TextHub.vue
  ├─ 左侧: textarea (v-model=input)  + 类型探测徽标 (detect.ts)
  ├─ 右侧: 垂直大类 Tab → 大类下单层面板组件
  └─ 底栏: stats.ts 统计 + 已识别类型
```

**算法注册表**（`src/lib/text/registry.ts`）：

```ts
interface ToolItem {
  id: string          // 'base64', 'sha256' ...
  label: string
  category: Category  // 'encode' | 'hash' | 'stats' | 'timestamp' | 'smart'
  component: Component
}
```

- **确定性类**（编解码、哈希）：以 `input: string` 为原料，面板用参数表单（ROT13 位移、AES key）驱动重算。
- **统一面板类**（统计、时间戳、智能解码）：不写 N 个单算法组件，各写**一个**通用面板组件，内部消费 `stats.ts` / `timestamp.ts` / `smartdecode.ts`。

**数据流**：`input` 变化 → 当前激活子项的 `computed` 立即重算 → 每项结果行自带 `复制`/`下载`。所有产物 `watch(input)` 同步刷新；哈希对超大文本走增量（流式）。

**错误约定**：每个算法函数返回结构化结果 `{ ok, value, error? }`（或 `<T>Result` 联合）；非法输入返回 `ok:false` 而非抛错，UI 标红「无法解码」。

## 组件与状态

右侧面板拆成 5 个已确认组件 + 1 个框架（均在 `src/components/text/`）：

- **编解码组**
  - `EncodePanel.vue`：父面板，内部按注册表渲染各单算法子项（Base64 / Base64URL / URL / Unicode / Hex / HTML / ROT13）。每子项「编码 ⇄ 解码」左右同屏，各带 `复制`/`下载`；无意义的那个方向灰显「该方向不适用」。
  - `AesPanel.vue`：独立面板，带参数表单（密钥 / 模式=AES-GCM / IV）。表单变化立即重算。
- **哈希组 `HashPanel.vue`**：一个组件列表渲染 MD5 / SHA-1 / SHA-256 / SHA-512 / CRC32，每行 hex 摘要 + 复制。
- **统计 `StatsPanel.vue`**：字符/字节/行/非空行/词/单词 只读网格。
- **时间戳 `TimestampPanel.vue`**：扫描结果列表，每处命中带复制。
- **智能解码 `SmartDecodePanel.vue`**：`ok` / 警告横幅 + 解码链候选列表 + 最大轮次参数。

**状态管理**：无全局 store，靠 `TextHub.vue` 顶层状态 + props。

```ts
// TextHub.vue 顶层状态
input: string
inputType: DetectedType      // detect.ts 的结果
activeCategory: Category
prefs: { theme?, ... }       // localStorage key 'texthub:prefs'
```

- 面板均为**纯展示组件**，只通过 `props` 收 `input`，不持有输入本身；参数表单（ROT13 位移、AES key、智能解码轮次）为**组件内部 ref**。
- 视图文件：`src/views/TextHub.vue` + `src/lib/text/registry.ts`（引入各子项组件）。

## 算法与错误处理细节

### 编解码纯函数（`encoders.ts`），全部 `input:string → {ok, value|error}`

- Base64 / Base64URL：`btoa`/`atob` 包 try/catch；URL 安全变体做 `+→-`、`/→_`、去 `=`。
- URL 编码：`encodeURIComponent` ⇄ `decodeURIComponent`（try/catch）。
- Unicode：`\uXXXX` 转义 ⇄ 反转义。
- Hex：字节间 `空格/无` 分隔一律接受；解码遇非 hex 字符 → `ok:false`。
- HTML 实体：用浏览器 `textarea.innerHTML` 技巧解 `&amp;`，编码走转义映射表。
- ROT13：位移量参数（默认 13），仅 A-Z/a-z。

### AES（`aes.ts`）

WebCrypto `crypto.subtle` AES-GCM，密钥从口令经 PBKDF2 派生（固定盐，盐/IV 参数可填）。加解密都返回 base64 结果；失败（错误密钥/损坏 IV）→ 面板标红错误信息。

### 哈希（`hashes.ts`）

- SHA-1/256/512：`crypto.subtle.digest`（每次重算）。
- MD5 / CRC32：小型自实现；超大文本增量分批喂入，避免长文本卡顿。
- 太长下限流：结果面板限制展示长度并提示。
- 明确：哈希的「增量/流式」仅限 MD5/CRC32 自实现部分；SHA 系列每次整体 `crypto.subtle` 重算。

### 统计（`stats.ts`）

`Array.from` 按 code point 数 emoji；UTF-8/UTF-16 字节用 `TextEncoder`/`TextDecoder`；行/非空行/词/单词各一计数。

### 时间戳（`timestamp.ts`）

- 扫描 10/13 位数字 → 识别 Unix 秒/毫秒 → 本地时间 + ISO。
- 扫描日期串（`2026-08-22 10:30` / `2026/08/22` / `10:30AM`）→ 反向给 Unix 秒/毫秒。
- 每处命中输出 `{ raw, type, local, iso, unixMs, unixSec }`。

### 类型探测（`detect.ts`）

依次测 JSON / URL / Base64 / UUID / 时间戳 / Base32 / 十六进制 → 返回单个 `DetectedType` 徽标。

### 智能解码（`smartdecode.ts`）

BFS 式迭代，每步尝试 Base64 / URL / Hex / Unicode / HTML / ROT；用启发式打分（可打印字符比例 + 是否 JSON/URL + 置信度分数）；默认最大轮次 8、结果上限防指数爆炸；UI 横幅：「智能解码为启发式结果，结果仅供参考」。输入为空/全空格时所有面板进空态。

## 文件结构

```
src/lib/text/
  detect.ts      # 输入类型探测
  encoders.ts    # Base64/Base64URL/URL/Unicode/Hex/HTML/ROT13
  aes.ts         # WebCrypto AES-GCM 封装
  hashes.ts      # SHA 系列（WebCrypto）+ MD5/CRC32 小型实现（增量）
  stats.ts       # 字符/字节/行/词统计
  timestamp.ts   # 时间戳与日期串双向识别
  smartdecode.ts # 智能解码链 + 置信度打分
  registry.ts    # 算法注册表
src/views/TextHub.vue           # 页面：左输入 + 右 Tab 结果
src/components/text/            # 各子面板组件
  EncodePanel.vue / AesPanel.vue / HashPanel.vue
  StatsPanel.vue / TimestampPanel.vue / SmartDecodePanel.vue
```

- 算法层均为**纯函数**，`input: string` → 结构化结果，便于 `vue-tsc` 类型保证与自测。
- AES 用浏览器原生 `crypto.subtle`（WebCrypto），不引入重依赖。

## 数据与状态

- 输入文本**不持久化**（隐私 + 无必要），仅内存状态；刷新即失。
- 主题、字号等少量偏好走 localStorage（key: `texthub:prefs`）。
- 支持从本地文件导入文本（`<input type="file">` + `FileReader`），导出为 `.txt`（`Blob` + `download`）。

## 边界情况

- 空输入 / 全空格：空态占位，不崩。
- 非法编码输入（非法 Base64、Hex 含非十六进制字符）：标红提示「无法解码」而非报错。
- 超大文本（> 数 MB）：哈希走增量，编解码面板分页或限制展示长度并提示。
- 二进制/emoji 文本：字符数与字节数按 UTF-8 code point 正确区分统计，不歪曲。

## 样式

遵循工具开发约定：只用语义 token（`bg-card` / `bg-accent` / `text-destructive` / `border-border` / `bg-primary` 等）；面板统一 `rounded-lg border` 卡片 + `border-b` 标题栏 + `text-xs uppercase tracking-wider` 小标题；错误横幅用 `border-destructive/50 bg-destructive/10 text-destructive`；交互元素带 `focus-visible:ring-2`。

## 测试

所有算法层为纯函数，构建期 `vue-tsc --noEmit` 保证类型；在 `src/lib/text/` 各纯函数文件头用注释自测关键样例（无独立测试框架）。覆盖：Base64/URL/Hex/Unicode/HTML round-trip；非法输入 → `ok:false`；Unicode 转义往返（中文/emoji）；Hash 已知正确摘要 + 空输入；时间戳秒/毫秒↔日期串双向与边界（1970、2038+）；统计对 emoji（`Array.from`）与 CRLF 行数；智能解码已知链 round-trip 与轮次上限。

## 路由与入口

- 路由注册：`src/router/index.ts` 增加 `/text-hub`（懒加载 `() => import('@/views/TextHub.vue')`）。
- 首页 `Home.vue` 增加工具卡片（icon + 名称 + 描述 + route）。

## 不做的事

- 运行期联网；所有算法本地执行。
- 文本云端分享 / 历史记录。
- 文本持续化（输入不持久化，仅内存；刷新即失）。
- 文件内 diff（svn 式）另议。
- 拼写检查 / 翻译 / 全文检索等语义级能力。
- 引入第三方加密库（哈希/AES 走原生 WebCrypto + 小型自实现）。