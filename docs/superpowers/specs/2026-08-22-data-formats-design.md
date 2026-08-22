# 结构化数据互转（DataFormats）设计

> 状态：已定稿 · 日期：2026-08-22 · 模式：纯前端离线
> 本设计将现有 **JSON 编辑器** 工具升级为 **结构化数据互转** 工具。

## 一、定位与决策

核心架构为 **`Records` 中间模型**：任何格式进 → `Records` → 任何格式出。新增格式只要写一对「导入/导出 adapter」并在注册表登记，远小于两两互转的 M×N 矩阵成本。

经澄清确定的本次落地决策：

1. **落地方式**：改造替换 JSON 工具——`/json` 路由指向新的互转工具 `DataFormats.vue`，首页卡片【JSON 编辑器】更名为【结构化数据互转】。
2. **涵盖格式**：**全部文本格式** = JSON / YAML / CSV / TOML / XML，共 5 种。**不含 Excel**（次批，独立接入 SheetJS）。
3. **预览表格**：基础渲染 + **列拖拽调序** + **列头勾选隐藏/跳列**。
4. **库依赖**：引入 `yaml` 与 `smol-toml`；XML 用浏览器内建 `DOMParser`；CSV 与 JSON 自实现。
5. **离线约束**：所有依赖经 npm 安装由 Vite 构建打进 bundle，**运行时零 CDN 请求**，完全离线可用。
6. XMIND 为独立高级子工具，**不混入主互转管道**（本设计不实现）。

## 二、整体架构与模块划分

采用 **adapter 注册中心 + Records**（方案 A）：

```
src/lib/dataformats/
  records.ts          # Records/Cell 类型 + 校验 + 嵌套展开/扁平化 + 脏CSV补齐
  registry.ts         # 格式注册表：format → { id, label, importer, exporter, ext }
  importers/
    json.ts  yaml.ts  csv.ts  toml.ts  xml.ts     # 每格式: (text)=>Records
  exporters/
    json.ts  yaml.ts  csv.ts  toml.ts  xml.ts     # 每格式: (records)=>string
src/views/DataFormats.vue   # 替换 Json.vue，/json 路由指向它
```

- `registry.ts` 是**扩展点**：下拉项、导出扩展名、默认示例都由它派生；新增格式 = 加一对 importer/exporter 文件 + 在 registry 登记一行。
- importer / exporter 统一契约：
  ```ts
  type Importer = (text: string) => Records
  type Exporter = (records: Records) => string
  ```
  两者都可能抛 `FormatError`；每个格式 `{ id:'json', label:'JSON', importer, exporter, ext:'json' }`。

## 三、记录模型与嵌套展开策略

### 核心类型

```ts
type Cell = string | number | boolean | null
interface Records { columns: string[]; rows: Cell[][] }
```

- 行与列长度强制一致（`record` 构造时校验对齐）。
- 空输入 / 空文件：返回 `Records { columns: [], rows: [] }`，占位空表格，不报错。

### 导入展开（扁平化）策略

JSON / XML / TOML 的嵌套结构有 3 种可选策略（所有 importer 共用）：

1. `flatten`（默认）：点路径展开为列名。对象 `{a:{b:1}}` → 列 `a.b`，值 `1`；对象数组按其列和逐行铺开；嵌套数组默认序列化。深度上限 **5**（可配），超限子树整块落入一列 JSON 字符串，避免列爆炸。
2. `firstLevel`：忽略深层，仅取顶层字段。
3. `raw`：整棵树转一列 `data`（JSON 字符串），适合结构不规整的输入。

- JSON 单对象 → 1 行；对象数组 → 按列铺开；顶层标量 → 一列 `data`。
- **表头去重**：重复列名自动追加后缀，如原列名重复 → `b`、`b_1`。

### 导出重建（嵌套）

- 默认列名仅处理一级：`a.b` 拆分为嵌套对象，结果为对象数组。
- 列名含 `.` 时按路径重建嵌套结构。
- 序列化统一 `JSON.stringify(…, null, 2)`（JSON 目标）。

## 四、各格式 importer/exporter 细节

### JSON（自实现，无新依赖）

- importer：`JSON.parse` → 统一嵌套展开（3 策略）。
- exporter：records → 对象数组（按列路径重建嵌套），缩进 2。

### CSV（自实现，覆盖转义边界）

- importer：RFC4180 解析，支持引号包裹、`""` 转义、字段内逗号/引号/换行、表头去重、脏行按最大列补齐（抛/提示 `PaddingError`）。
- exporter：每字段按需加引号/转义；`\r\n` 行尾；首行表头；UTF-8 **带 BOM**（Excel 友好）。

### YAML（`yaml` 库）

- importer：`parse(text)` → 统一嵌套展开。
- exporter：`stringify(records)`（数组/对象结构）。

### TOML（`smol-toml` 库）

- importer：`parse(text)` → 转单张 `Records`（一列一键，或按顶层表格关联行），列名取键路径。
- exporter：`stringify`，列名按点路径写入嵌套 `[table]`。

### XML（浏览器 `DOMParser`）

- importer：遍历元素 → 每行一个同级重复节点；子元素取叶内容，属性取 `@attr` 列；嵌套按统一策略展开。
- exporter：列名拆分路径，重复行生成同级节点。

所有 importer/exporter 抛 `FormatError{ message, line?, col? }`，视图层顶栏横幅定位到行列。

## 五、视图层交互与页面状态

沿用现有工具约定（语义 token、面板观感、可访问性习惯），替换 `/json` 路由指向 `DataFormats.vue`，首页卡片更名。

**状态**（全部 `ref`，URL 不承载大文本）：

```ts
sourceFormat, targetFormat     // 下拉
sourceText                     // 源编辑区
records                        // 解析+校验后的中间模型
targetText                     // 目标编辑区
columnState                    // 列调序/隐藏映射（作用于 records 之上）
error                          // { message, line?, col? } | null
stats                          // 源行数/列数/字节数
```

- **顶部操作行**：「←返回 | 结构化数据互转」右：复制 / 导入 / 导出（导入按源格式选扩展名，导出按目标格式）。
- **工具行**：`源格式[下拉]`、`目标格式[下拉]`、`反向 ↔` 一键对调源/目标格式与文本。
- **三栏布局**（桌面 `grid` 三列 / 移动端堆叠）：
  1. 左：源格式 + 源编辑区（复用现有 syntax-highlight 编辑器叠加层）。
  2. 中：预览表格——表头**拖拽调序** + 列头**勾选隐藏列**；底部 `行数/列数`。
  3. 右：目标格式 + 结果编辑区（复制 / 下载）。
- **错误横幅**：`border-destructive/50 bg-destructive/10 text-destructive`，报 `FormatError` 原文 + `第{line}行 第{col}列`。
- **校验通过**：底部状态栏 `✓ 行数 N | 列数 M | 字节 B`。
- **localStorage 暂存** key `datafmt:last` 保存 `{sourceFormat, targetFormat, sourceText}`，刷新恢复（读写失败静默忽略）。
- **结果导出**：`Blob` + `URL.createObjectURL` + `<a download>`，扩展名取 registry 的 `ext`。

## 六、错误处理、边界情况与测试

### 错误处理

- 统一 `FormatError{ message; line?; col? }`，所有 importer/exporter 抛出。
- 解析失败 → 红色顶栏横幅显示 `message` + 行列定位；`records` 置空，目标区清空，不崩溃。
- 脏 CSV：行/列不一致 → 按最大列补齐空值，并在横幅提示「检测到列数不一致，已按最大列补齐」。
- 空输入 / 空文件 → 空表格占位，不报错。

### 边界情况

- 空输入、空文件、纯表头无数据行。
- 字段内引号 / 逗号 / 换行的 CSV 正确读写。
- 表头列名重复 → 去重加后缀。
- 嵌套过深 JSON / XML（深度 > 5）→ 整块降级为一列 JSON 字符串。
- 超大文本（数 MB）：仅 `records` 派生计算，不重复解析；预览表格**分页**（每页 50 行）+ 底部翻页，避免整表 DOM 卡顿。
- 特殊字节 / 非法 UTF-8：导入用 `FileReader.readAsText('utf-8')`，容忍替换字符。

### 测试

沿用 `scripts/verify-*.ts` 模式，新增 `scripts/verify-dataformats.ts`：

- 每格式 round-trip（import → export → import 一致）。
- CSV 转义用例（引号 / 逗号 / 换行在字段内）。
- 脏行补齐；三种嵌套展开策略；深嵌套降级；表头去重。
- 空输入；非法格式抛 `FormatError`（带行列）。

## 七、依赖变更

- `dependencies` 新增：`yaml`、`smol-toml`。
- 运行时零 CDN 请求，所有资源构建打包。

## 八、不做的事

- 不做在线数据源 / 联网。
- 不做 XMIND 混入主管道（独立子工具，本设计不实现）。
- 不做 Excel `.xlsx`（次批，独立接入 SheetJS）。
- 不做公式引擎 / 数据清洗透视（仅结构互转 + 基础校验）。
- 不做自定义单元格合并等排版能力。