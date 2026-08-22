# 单位换算工具设计（文本自动识别 + 全量等价）

日期：2026-08-22
状态：已确认

## 目标

在工具箱中新增「单位换算」工具（路由 `/units`）。用户输入 `30kg`、`$1.99`、`2h`、`5'9"`、`1/2` 这类**自然文本片段**，工具自动识别数值与单位/货币符号，一次列出该量纲下的**全部等价项**，每项可复制。用户不需要预先选择目标单位——这是与传统换算工具的最大差异。

纯前端离线可用；汇率采用「内置快照 → indexedDB 缓存 → 在线拉取刷新」的降级链，不阻塞、不报错打扰。

## 核心决策（用户已确认）

1. **手动选择表**：v1 就实现，作为**折叠**区块（默认收起），满足想精确指定目标单位的场景。
2. **汇率策略**：stale-while-revalidate 降级链——先以内置快照/缓存立即渲染，后台并行在线拉取，成功后刷新。缓存存 **indexedDB**（key `units:rates`，TTL 24h）。在线源 `https://open.er-api.com/v6/latest/USD`（免费无 key、支持 CORS、约 160 种币种、含 `time_last_update_utc`/`base_code`/`rates` 元数据）。
3. **单位歧义**：`m` 默认米（分钟不参与歧义）；歧义靠注册表预置权重自动选最可能量纲；纠偏交给手动选择表，不做额外量纲切换 UI。
4. **货币符号**：`¥` = 人民币（CNY），`JP¥` / `円` / `JPY` = 日元；`$` / `US$` = 美元。符号 → 币种对照表藏于顶栏帮助 tooltip，不占主空间。
5. **数据量进制**：1000（SI，与 k/M/G/T 词缀一致）。
6. **密度常量**：v1 不做（非 8 种量纲之一），`rates.json` 仅存汇率。

## 量纲与单位注册表（registry.ts）

8 种量纲，单位定义 `{ canonical, name, symbol, dim, factor?, formula?, weight? }`：

| 量纲 | 基准 | 单位（canonical，别名略） |
| --- | --- | --- |
| 长度 length | m | m/km/cm/mm/in/ft/yd/mi/里/尺/寸 |
| 重量 weight | kg | kg/g/mg/μg/t/lb/oz/斤/两/磅 |
| 数据量 data | B | B/KB/MB/GB/TB（1000 进制） |
| 温度 temperature | ℃ | ℃/℉/K（公式非线性） |
| 面积 area | ㎡ | ㎡/km²/ha/亩/平方尺/平方英尺(ft²)/英亩(acre) |
| 体积 volume | L | L/mL/m³/cm³(cc)/gal(美制默认)/升/毫升 |
| 时间 time | s | ms/s/min/h/day/week（month/year 为近似，标注） |
| 货币 currency | USD | 见「货币」节 |

- **词缀**：k/M/G/T（千/兆/吉/太）自动展开，如 `kg`、`mg`、`MB`、`GB`；小词缀 m/μ 手动列（`mg`、`μg`）。
- **别名 → canonical**：`公斤/千克→kg`、`磅→lb`、`亩→亩`、`天→day`、`小时→h` 等；中文/英文/符号多别名。
- **温度公式**（非线性，标注「基于公式换算」）：`F = C*9/5+32`、`K = C+273.15`。
- **斤/两**：中国大陆标准 1 斤 = 500 g、1 两 = 50 g。
- **gal**：默认美制加仑（3.7854 L），文档注明。
- **month/year**：按 30 天 / 365 天近似，结果标注「近似」。

## 词法引擎（lexer.ts）

单一 token 管道，统一建模前置符号 / 后置单位 / 复合符号：

```
[符号?] 数值 [单位?]
数值 = 整数 | 小数 | 千分位(1,000) | 科学计数(1e3) | 分数(1/2) | 英尺-英寸复合(5'9")
```

- 返回片段数组：`{ raw, value, unit?, symbol?, dim?, error? }`；每个片段为「数值 + 可选单位」。
- 复合 `5'9"`：优先匹配 `(\d+)['](\d+)["]` → 5 英尺 9 英寸 = 69 in，作为单一片段。
- 分数 `1/2`：`\d+/\d+` → 0.5；与 `5'9"` 通过正则优先级区分。
- 符号识别：前置货币符（`$`、`¥`、`€`…）与后置单位（`kg`、`h`、`USD`…）用注册表**最长匹配**。
- 无法识别：`error` 置位，前端灰显并提示「无法识别片段：xxx」。

## 货币（money.ts + rates.json + idb.ts）

### 符号 → 币种映射（对照表，藏于帮助 tooltip）

| 符号 | 币种 | 代码 |
| --- | --- | --- |
| `$` / `US$` / `USD` | 美元 | USD |
| `¥` / `CN¥` / `人民币` / `CNY` | 人民币 | CNY |
| `€` / `EUR` / `欧元` | 欧元 | EUR |
| `£` / `GBP` / `英镑` | 英镑 | GBP |
| `JP¥` / `円` / `JPY` / `日元` | 日元 | JPY |
| `HK$` / `港币` / `HKD` | 港币 | HKD |
| `A$` / `AUD` | 澳元 | AUD |
| `C$` / `CAD` | 加元 | CAD |
| `S$` / `SGD` | 新加坡元 | SGD |
| `CHF` / `瑞郎` | 瑞士法郎 | CHF |

- `$` 单独出现默认美元；`¥` 单独出现默认人民币。
- 后置词（`USD`/`CNY`/`美元`/`港币`…）同样识别。
- 任意两币换算：`v(Y) = v(X) * rate[X] / rate[Y]`（快照以 USD 为基准）。
- **货币等价项默认列上述 10 个常用币种**（避免 160 行刷屏），结构上支持全量；无汇率数据的币种标注「无汇率数据」，仅做符号识别。

### 汇率数据链（stale-while-revalidate）

1. **立即渲染**：用内置快照 `src/data/rates.json`（开发期从 open.er-api.com 抓取，含 `_source` / `_updatedAt` / `base` / `rates`）。
2. **后台并行**：读 indexedDB 缓存（key `units:rates`，TTL 24h）→ 若有更新的快照则切换显示。
3. **在线刷新**：`fetch(open.er-api.com/v6/latest/USD)`，8s 超时；成功后写入 indexedDB（含 `_fetchedAt`）并刷新显示。
4. **失败**：保持当前数据（内置快照或缓存），静默，不打扰。
5. **状态栏**：如实显示来源——`汇率：在线更新 · 2026-08-22` / `本地缓存 · 2026-08-20` / `内置快照 · 2026-08-19`（替代原稿「无在线字样」，因现在确有联网行为）。

### 文件结构

```
src/
  lib/units/
    lexer.ts      # 数值+单位 词法切分
    registry.ts   # 单位词缀库：别名→{canonical, factor, dim, symbol}
    convert.ts    # 量纲内 单值→全部等价项；温度/汇率特殊处理
    money.ts      # 货币符号识别 + 快照汇率换算
    idb.ts        # 极简 IndexedDB 封装（存汇率快照，TTL 24h）
  data/rates.json # 汇率快照（含 _source/_updatedAt，来源见许可节）
  views/Units.vue # 页面
scripts/
  update-rates.ts # 开发期从 open.er-api.com 重抓覆盖 rates.json
  verify-units.ts # 逻辑自检（node scripts/verify-units.ts）
```

路由注册到 `src/router/index.ts`，首页 `Home.vue` 增加工具卡片（icon 🧮）。

## 页面布局与交互（遵循 tool-dev-convention）

1. **顶栏**：`← 返回 | 单位换算` + 右侧帮助 `?` 图标（悬停 tooltip，radix-vue Tooltip 已在依赖）展示**符号→币种对照表**。
2. **输入区**：单行输入 + 主按钮 `换算`（回车同样触发）；placeholder「如 30kg 和 $1.99」；下方提示「支持多个片段，如 "30kg 和 $1.99"」。
3. **结果区**（按片段分卡片）：
   - 每卡片：`片段: 30 kg`（raw + 规范化单位）+ 量纲标签 + 等价项列表，每项 `[复制]`。
   - 无法识别片段：灰显 + `无法识别片段：xxx`。
4. **手动选择表**（折叠，默认收起）：量纲 → 源单位 → 目标单位 → 数值 → 结果；偏好存 localStorage `units:pref`。
5. **底部状态栏**：左 `汇率：<来源> · <日期>`；右 `识别 N 段 · 无法识别 M 段` + 操作反馈（复制成功等短暂显示）。
6. **样式**：仅语义 token（`bg-card`/`bg-accent`/`text-muted-foreground` 等），交互元素 `focus-visible:ring-2`，复制 `navigator.clipboard.writeText` + try/catch。

## 边界情况

- 无单位纯数字：提示「未识别到单位」。
- 无法识别片段：灰显 + 具体提示。
- 汇率无该币种数据：标注「无汇率数据」，仅做符号识别。
- 温度：公式换算，标注「基于公式换算」。
- 超大/极端小数值：科学计数显示（如 `3.0e+8`）。
- `1,000` 千分位、`1e3` 科学计数、`-5℃` 负号、`5'9"` 复合、`1/2` 分数均需覆盖。
- 空输入 / 仅空白：忽略，无操作。
- 输入文本不持久化（隐私）；仅汇率缓存（indexedDB）与 `units:pref`（localStorage）持久化。
- indexedDB / localStorage 解析失败：静默降级到内置快照 / 默认偏好。

## 测试

- `src/lib/units/*` 为纯函数，构建期 `vue-tsc --noEmit` 保证类型。
- `scripts/verify-units.ts`（`node scripts/verify-units.ts`）关键样例自检：
  - 词法：`30kg` / `$1.99` / `2h` / `5'9"` → 69in / `1/2` → 0.5 / `1,000` → 1000 / `1e3` / `-5℃` / 无单位纯数字 / 无法识别片段。
  - 长度：`1 mi` = 1609.344 m；重量：`1 斤` = 500 g = 0.5 kg；数据量：`1 GB` = 1000 MB = 1e9 B。
  - 温度：`100℃` = 212℉ = 373.15K（round-trip）；面积：`1 亩` = 666.67 ㎡；体积：`1 gal` = 3.7854 L；时间：`1 week` = 7 day = 604800 s。
  - 货币：`$1.99` → CNY 用快照汇率；`¥100` 与 `JP¥100` 区分；无汇率币种标注。

## 不做的事

- 在线行情之外的实时数据 / 多次自动轮询（在线仅在进入页面时后台拉一次）。
- 任意字符串语义理解（仅数值 + 单位）。
- 8 种量纲之外的高阶物理量（压力、能量、密度等）。
- 密度常量快照（v1 不涉及该量纲）。
- 输入文本持久化（隐私）。
- Tauri Rust 后端 HTTP 插件（在线拉取用 WebView fetch，失败静默降级）。

## 许可与数据来源

- 在线汇率源 open.er-api.com（exchangerate-api.com 免费接口，免 key，CORS 开放）。
- `rates.json` 文件头含 `_source`（来源 URL）与 `_updatedAt`（快照日期）元字段；更新 = 运行 `scripts/update-rates.ts` 重新抓取覆盖。
