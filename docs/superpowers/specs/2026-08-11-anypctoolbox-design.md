# AnyPCToolbox — 设计文档

## 概述

AnyPCToolbox 是一个跨平台 PC 工具箱，纯前端实现，支持离线运行。第一期提供两个工具：Markdown 编辑预览器和 JSON 编辑器。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 构建工具 | Vite | 极速 HMR，单命令构建 |
| 框架 | Vue 3 (Composition API + TypeScript) | 组件化开发 |
| UI 组件库 | shadcn/ui (Vue 版) | Radix UI 原语，统一设计语言 |
| 主题 | CSS 变量驱动 | 亮暗双主题一键切换 |
| 桌面端 | 浏览器 / PWA / 任意 WebView | 无需后端，浏览器打开即可运行 |

所有依赖均为 npm 包，本地安装，完全离线可用。

## 架构

### 构建流程

```
npm 依赖 (本地安装)
    → Vite 构建 (Vue3 + shadcn/ui)
        → 静态产物 (HTML / CSS / JS)
```

### 运行方式

- **桌面端**：浏览器打开 `index.html`，或使用 PWA / WebView 包装
- **Web 端**：Vite 构建产物部署到任意静态文件服务器

同一份前端代码，两种运行方式，无需任何后端。

## 项目结构

```
anypctoolbox/
├── src/
│   ├── App.vue                 # 根组件 (主题 + 布局)
│   ├── main.ts                 # 入口文件
│   ├── router/
│   │   └── index.ts            # 路由配置
│   ├── views/
│   │   ├── Home.vue            # 主页 — 工具卡片引导
│   │   ├── Markdown.vue        # Markdown 编辑 & 预览
│   │   └── Json.vue            # JSON 编辑 & 格式化
│   ├── components/
│   │   ├── ToolCard.vue        # 工具卡片组件
│   │   ├── ThemeToggle.vue     # 主题切换
│   │   └── AppLayout.vue       # 通用布局框架
│   ├── composables/
│   │   └── useTheme.ts         # 亮暗主题逻辑
│   ├── lib/
│   │   ├── markdown.ts         # Markdown 解析逻辑
│   │   └── json.ts             # JSON 格式化逻辑
│   ├── assets/
│   └── style.css               # 全局样式
├── public/                     # 静态资源
├── index.html
├── package.json
├── vite.config.ts
└── components.json             # shadcn/ui 配置
```

## 路由设计

| 路径 | 组件 | 说明 |
|---|---|---|
| `/` | Home.vue | 主页，工具卡片引导页 |
| `/markdown` | Markdown.vue | Markdown 编辑与预览 |
| `/json` | Json.vue | JSON 格式化与预览 |

## 组件树

```
App.vue
├── ThemeToggle.vue          # 主题切换开关 (fixed 位置)
└── <router-view>
    ├── Home.vue
    │   └── ToolCard.vue × N    # 工具卡片列表
    ├── Markdown.vue
    │   ├── CodeMirror/Textarea (编辑区)
    │   └── Markdown 渲染区 (预览区)
    └── Json.vue
        ├── Textarea (编辑区)
        ├── 工具栏 (格式化/压缩/校验)
        └── 树形预览区
```

## 页面设计

### 主页 (Home.vue)

- 顶部导航栏：Logo + 应用名 + 主题切换开关
- 页面标题："工具集合"
- 工具卡片网格 (CSS Grid, `minmax(240px, 1fr)`)
- 每张卡片包含：图标 + 名称 + 描述 + 版本标签
- 悬停效果：阴影 + 边框高亮
- 预留"更多工具"占位卡片
- 点击卡片跳转对应工具页

### Markdown 工具页 (Markdown.vue)

- 顶部导航栏："← 返回" + 工具名 + 操作按钮 (复制/导入/导出)
- 左右分栏布局：
  - 左侧：编辑区 (Textarea / CodeMirror)
  - 右侧：实时预览区 (渲染后的 HTML)
- 窄屏自动切换为上下布局
- 预览支持：标题、段落、粗体/斜体、代码块、行内代码、引用、列表、链接

### JSON 工具页 (Json.vue)

- 顶部导航栏："← 返回" + 工具名 + 操作按钮 (复制/导入/导出)
- 工具栏：格式化 / 压缩 / 校验 / 展开全部 / 折叠全部
- 左右分栏布局：
  - 左侧：编辑区 (Textarea)
  - 右侧：树形预览区 (语法着色)
- 状态栏：校验状态 + 行数 + 字符数 + 大小
- 错误时显示红色错误提示条
- 窄屏自动切换为上下布局

## 亮暗主题

采用 CSS 变量驱动，通过 shadcn/ui 的主题系统实现：

- 浅色模式：白色背景、深色文字、浅灰边框
- 深色模式：深色背景、浅色文字、深灰边框
- 所有组件通过 CSS 变量统一适配
- 主题偏好保存在 `localStorage`

## 第一期工具详情

### 工具 1：Markdown 编辑及预览

- 核心依赖：`markdown-it` (Markdown 解析) + `highlight.js` (代码高亮)
- 功能：
  - 在编辑区输入 Markdown 文本，右侧实时渲染预览
  - 支持 GFM (GitHub Flavored Markdown)
  - 代码语法高亮
  - 导出为 HTML 文件
  - 从本地文件导入.md 文件
  - 复制内容到剪贴板

### 工具 2：JSON 编辑及预览

- 纯 TypeScript 实现格式化逻辑
- 功能：
  - JSON 格式化（美化输出，带缩进）
  - JSON 压缩（单行输出）
  - JSON 校验（错误定位 + 错误信息提示）
  - 树形预览（语法着色：键=蓝色、字符串=绿色、数字=橙色、布尔值=紫色、null=灰色）
  - 展开/折叠 JSON 树
  - 从本地文件导入.json 文件
  - 导出为.json 文件
  - 复制到剪贴板
  - 状态栏显示统计信息

## 依赖清单

```json
{
  "dependencies": {
    "vue": "^3.5",
    "vue-router": "^4",
    "radix-vue": "^1",
    "class-variance-authority": "^0.7",
    "lucide-vue-next": "^0.400",
    "tailwind-merge": "^2",
    "tailwindcss": "^3.4",
    "@tailwindcss/typography": "^0.5",
    "markdown-it": "^14",
    "highlight.js": "^11"
  },
  "devDependencies": {
    "vite": "^6",
    "@vitejs/plugin-vue": "^5",
    "typescript": "^5.6",
    "vue-tsc": "^2",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

## 非功能性需求

- 离线运行：所有依赖在项目初始化时通过 `npm install` 本地安装，构建后无需网络
- 响应式设计：适配桌面到移动端不同分辨率
- 跨平台：任何支持现代浏览器的设备均可运行
- 性能：编辑时实时预览延迟 < 100ms