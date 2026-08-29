# HTTP 接口调试器（Postman类）设计文档

- 日期：2026-08-29
- 状态：已确认
- 入口路由：`/http-client`（主页卡片名「HTTP 接口调试」）

## 1. 背景与目标

在 Tauri + Vue3 + TS 工具集 AnyPCToolbox 中新增一个类似 Postman 的接口调试工具。核心差异在于**可视化**：不只提供 text/json 原始编辑器，而是把「复杂的请求结构」与「分页响应数据」用更友好高效的 UI 呈现，让开发者不必对着冗长 JSON 调试。

### 已与用户确认的关键决策
- 项目是 **web + tauri 多端**，请求**只能纯前端 fetch**（不引入 Rust 后端）。CORS 跨域限制作为已知局限展示在错误提示中。
- 请求建模采用「**请求模板 + 变量**」：模板里写 `{{变量名}}`，发送页自动提取为表单，发送时替换。
- **字段映射 + 特殊渲染全部进入 V1**（枚举映射、图片 URL 渲染等）。
- JSONPath 解析配置**每个接口自带一份**，随接口持久化。
- 路由不用 `/api`（避免与后端接口前缀混淆）。
- 布局上「**配置**」与「可视化运行」分离为顶层 Tab，一次专注一件事。
- 配置文件类面板采用**可折叠侧栏**，提升调试专注度。
- **全局变量**放进独立的「环境管理」。
- V1 附加特性：**全局变量、请求历史、导入导出**。（不做「从响应回填变量」「curl 互导」）

## 2. 总体架构

- 新增视图 `src/views/HttpClient.vue`，路由 `/http-client`，配套模块：
  - `src/lib/debugger/model.ts` — 类型定义
  - `src/lib/debugger/db.ts` — IndexedDB 持久化（沿用 units `idb.ts` 极简封装风格）
  - `src/lib/debugger/variables.ts` — 占位符提取 / 替换 / 全局变量合并
  - `src/lib/debugger/send.ts` — fetch 发送 + JSONPath 解析
  - `src/lib/debugger/renderers.ts` — 列类型渲染
  - `src/components/debugger/*` — 界面组件
- 引入轻量依赖 `jsonpath-plus`（ESM、浏览器可用）。
- 遵循 [工具开发约定](../2026-08-18-tool-dev-convention.md)：语义色 token、`rounded-lg border` 面板、返回 + 底部状态栏、`.dark` 兼容。

### 美学方向（frontend-design）
「**聚焦调试台 / precision console**」：以信息密度与高可读性为纲，技术字段使用等宽字体，HTTP 方法使用区分色，列类型渲染用节制徽章，整体克制不花哨——让用户在「配置」「运行」两个状态里保持专注。

## 3. 数据模型（IndexedDB）

```ts
interface ApiRequest {
  id: string
  protocol: 'http'            // 预留 'ws' | 'graphql'
  name: string
  method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'
  urlTemplate: string         // 可含 {{var}}，如 https://x.com/users/{{userId}}
  query:  KvItem[]            // { key, value }，value 可含 {{var}}
  headers: KvItem[]
  bodyType: 'none'|'json'|'form'|'text'
  bodyText: string            // 可含 {{var}}
  variables: VariableDef[]    // 自动提取 + 手工维护默认值/描述
  parse: ParseConfig          // 每接口自带
  updatedAt: number
}

interface KvItem { key: string; value: string }

interface VariableDef {
  name: string
  value: string        // 发送时使用的当前值
  desc?: string
}

interface ParseConfig {
  listPath: string     // 列表 JSONPath，如 $.data.list
  totalPath?: string   // 总数路径
  pagePath?: string    // 页码路径
  columns: ColumnDef[]
}

interface ColumnDef {
  field: string                  // 列表项内字段名
  title: string
  type: 'text'|'number'|'bool'|'enum'|'image'|'datetime'|'link'
  enumMap?: Record<string,string>  // 如 { 1:'男', 2:'女' }
  width?: number
}
```

持久化：复用 `anypctoolbox` 库，新增 store `api_requests`（按 `id` 读写）。

## 4. 页面布局

三栏工作台，左栏接口列表，中间区用顶层 Tab 分隔「配置 / 运行·可视化 / 历史」，配置面板均为可折叠侧栏。

```
┌───────────┬──────────────────────────────────────────────────────────────┐
│ 接口列表    │  [配置]  [运行·可视化]  [历史]      ⚙ 环境管理                  │
│ +新建      ├──────────────────────────────────────────────────────────────┤
│ └接口A     │  当前 Tab 内容全屏，专注一件事                                   │
│  ├接口B    │                                                              │
│  └接口C    │                                                              │
└───────────┴──────────────────────────────────────────────────────────────┘
```

### 4.1 左栏：接口列表
新建 / 重命名 / 删除 / 搜索 / 切换。

### 4.2 「配置」Tab
- 顶部：Method ▾ + URL 模板输入。
- 可折叠侧栏分组：**Query Parameters**、**Headers**（键值行，可增删）。
- **Body**：切换 `none/json/form/text` + 文本编辑区。
- **解析配置**（每接口）：listPath / totalPath / pagePath + 字段列编辑器（字段名/标题/类型/enum 映射/宽度）。
- 只负责“把接口长什么样定下来”，不做发送。

### 4.3 「运行·可视化」Tab
- 顶部：变量表单（自动提取 `{{var}}` + `@全局变量`）→ **[发送]**。
- 响应区两个子视图切换：
  - **原始**：状态码（带色）+ 耗时 + 大小 + body（JSON 自动格式化高亮 / text）。
  - **表格视图**：按 ParseConfig JSONPath 抽 total/page/list → 表格 + 类型渲染，含分页条（读 total/page，重新携带当前变量请求）、空态、路径未命中提示。

### 4.4 「历史」Tab
当前接口最近 N 次发送记录，可回看。

### 4.5 环境管理（全局变量）
独立入口（⚙），维护共享变量（如 baseUrl/token）。配置与运行 Tab 通过 `@name` 引用。

## 5. 变量提取与请求发送

- **提取**：扫描 `urlTemplate + query[].value + headers[].value + bodyText` 中所有 `{{标识符}}`，去重写入 `variables`（不覆盖已有默认值/描述）。
- **合并**：模板变量 `{{var}}` 优先，未命中则回退 `@全局变量`。
- **替换**：发送前替换所有占位符；进 query 时 `encodeURIComponent`，进 body 时原样。
- **发送**：`fetch(fullUrl, { method, headers, body })`，`AbortController` 超时（默认 30s 可配）。
- **响应**：按 content-type / 试解析 JSON；存原始文本；记录到历史。

## 6. 可视化响应 + 字段类型渲染

渲染器集中在 `renderers.ts`，按 `ColumnDef.type` 分发：
- `text`/`number`：直接文本；`bool`：勾/叉徽章。
- `enum`：用 `enumMap` 映射（1→男、2→女）为带色徽章。
- `image`：图片 URL → `<img>`（懒加载、可放大预览）。
- `datetime`：数字时间戳（秒/毫秒自适应）或 ISO → 本地时间格式化。
- `link`：URL → 可点 `<a>`。

## 7. 错误处理

- fetch 网络/跨域异常 → `border-destructive` 横幅（⚠️ 提示 CORS/网络不可达）。
- HTTP 非 2xx 仍展示状态码与响应体。
- JSONPath 未命中 → 表格区提示 + 列出已解析顶层键。
- 补 `.dark` 变体。

## 8. WS / GraphQL 预留

`protocol` 字段已占位；发送器与解析器以「协议分发」组织，V1 仅实现 `http` 分支，后续补新分支不改模型骨架。

## 9. 范围界定（V1）

**做**：HTTP 请求模板+变量、可折叠配置侧栏、可视化表格响应、字段类型渲染（含枚举映射/图片）、每个接口自带解析配置、IndexedDB 持久化、全局变量（环境管理）、请求历史、导入导出、CORS 错误提示。

**不做**：WS/GraphQL 实际能力（仅占位）、从响应回填变量、curl 互导、请求编排/批量测试。