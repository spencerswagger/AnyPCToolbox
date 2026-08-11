# AnyPCToolbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform PC toolbox (Vite + Vue3 + shadcn/ui) with Markdown and JSON editors, featuring light/dark theme and offline-capable operation.

**Architecture:** Pure frontend SPA using Vite + Vue3 + TypeScript. All tools run in-browser with no backend. shadcn/ui provides the component system with CSS variable-driven theming. Vue Router handles page navigation between the home page and tool pages.

**Tech Stack:** Vite 6, Vue 3.5, TypeScript 5.6, Tailwind CSS 3.4, shadcn/ui (radix-vue), markdown-it 14, highlight.js 11, Vue Router 4

---

## File Structure

```
anypctoolbox/
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── style.css
│   ├── lib/
│   │   ├── markdown.ts
│   │   └── json.ts
│   ├── composables/
│   │   └── useTheme.ts
│   ├── components/
│   │   ├── AppLayout.vue
│   │   ├── ThemeToggle.vue
│   │   └── ToolCard.vue
│   ├── views/
│   │   ├── Home.vue
│   │   ├── Markdown.vue
│   │   └── Json.vue
│   └── router/
│       └── index.ts
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json
└── .gitignore
```

---

### Task 1: Scaffold Vite + Vue3 + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/style.css`
- Create: `env.d.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "anypctoolbox",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "radix-vue": "^1.9.0",
    "class-variance-authority": "^0.7.1",
    "lucide-vue-next": "^0.468.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss": "^3.4.0",
    "@tailwindcss/typography": "^0.5.0",
    "tailwindcss-animate": "^1.0.7",
    "markdown-it": "^14.1.0",
    "@types/markdown-it": "^14.1.0",
    "highlight.js": "^11.10.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "vite": "^6.0.0",
    "typescript": "~5.6.0",
    "vue-tsc": "^2.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "env.d.ts"]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AnyPCToolbox</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create .gitignore**

```
node_modules
dist
*.local
.env
.DS_Store
```

- [ ] **Step 7: Create env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create src/main.ts**

```ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(router).mount('#app')
```

- [ ] **Step 9: Create minimal src/App.vue**

```vue
<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>
```

- [ ] **Step 10: Create src/style.css with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 11: Run npm install**

Run: `npm install`
Expected: packages installed, no errors

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + Vue3 + TypeScript project"
```

---

### Task 2: Configure Tailwind CSS, PostCSS, and shadcn/ui

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `components.json`

- [ ] **Step 1: Create tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate, typography],
} satisfies Config
```

- [ ] **Step 2: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create components.json**

```json
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "default",
  "typescript": true,
  "tsConfigPath": "./tsconfig.json",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/style.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "framework": "vite",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 4: Create src/lib/utils.ts**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Add clsx to dependencies**

Update `package.json` to add `"clsx": "^2.1.0"` to dependencies.

- [ ] **Step 6: Run npm install**

Run: `npm install`
Expected: packages installed, no errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: configure Tailwind CSS, PostCSS, and shadcn/ui"
```

---

### Task 3: Create router configuration

**Files:**
- Create: `src/router/index.ts`

- [ ] **Step 1: Create src/router/index.ts**

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/markdown',
      name: 'markdown',
      component: () => import('@/views/Markdown.vue'),
    },
    {
      path: '/json',
      name: 'json',
      component: () => import('@/views/Json.vue'),
    },
  ],
})

export default router
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Vue Router with home/markdown/json routes"
```

---

### Task 4: Build theme system (useTheme composable + ThemeToggle)

**Files:**
- Create: `src/composables/useTheme.ts`
- Create: `src/components/ThemeToggle.vue`

- [ ] **Step 1: Create src/composables/useTheme.ts**

```ts
import { ref, watch } from 'vue'

const STORAGE_KEY = 'anypctoolbox-theme'

function getInitialTheme(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

const isDark = ref(getInitialTheme())
applyTheme(isDark.value)

watch(isDark, (val) => {
  localStorage.setItem(STORAGE_KEY, val ? 'dark' : 'light')
  applyTheme(val)
})

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
  }

  return {
    isDark,
    toggle,
  }
}
```

- [ ] **Step 2: Create src/components/ThemeToggle.vue**

```vue
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { Sun, Moon } from 'lucide-vue-next'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
           disabled:pointer-events-none disabled:opacity-50
           hover:bg-accent hover:text-accent-foreground
           h-9 w-9"
    @click="toggle"
    :title="isDark ? '切换亮色模式' : '切换暗色模式'"
  >
    <Sun v-if="!isDark" class="h-5 w-5" />
    <Moon v-else class="h-5 w-5" />
  </button>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add theme system with useTheme composable and ThemeToggle"
```

---

### Task 5: Build AppLayout component

**Files:**
- Create: `src/components/AppLayout.vue`

- [ ] **Step 1: Create src/components/AppLayout.vue**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex h-14 items-center justify-between px-4 md:px-6">
        <button
          class="flex items-center gap-2 font-semibold"
          @click="router.push('/')"
        >
          <span class="inline-flex items-center justify-center rounded-lg bg-primary p-1.5 text-primary-foreground text-sm">🧰</span>
          <span class="hidden sm:inline-block">AnyPCToolbox</span>
        </button>
        <div class="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <slot />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add AppLayout with header and theme toggle"
```

---

### Task 6: Build ToolCard component

**Files:**
- Create: `src/components/ToolCard.vue`

- [ ] **Step 1: Create src/components/ToolCard.vue**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Props {
  icon: string
  name: string
  description: string
  route: string
  tag?: string
}

const props = defineProps<Props>()
const router = useRouter()

function navigate() {
  router.push(props.route)
}
</script>

<template>
  <button
    class="group flex flex-col items-start rounded-xl border bg-card p-6 text-left
           shadow-sm transition-all hover:border-primary hover:shadow-md
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="navigate"
  >
    <span class="mb-3 text-4xl">{{ icon }}</span>
    <h3 class="text-base font-semibold">{{ name }}</h3>
    <p class="mt-1 text-sm text-muted-foreground leading-relaxed">{{ description }}</p>
    <span v-if="tag" class="mt-3 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {{ tag }}
    </span>
  </button>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add ToolCard component"
```

---

### Task 7: Build Home page

**Files:**
- Create: `src/views/Home.vue`

- [ ] **Step 1: Create src/views/Home.vue**

```vue
<script setup lang="ts">
import ToolCard from '@/components/ToolCard.vue'

const tools = [
  {
    icon: '📝',
    name: 'Markdown 编辑器',
    description: '编辑与实时预览 Markdown 文档，支持语法高亮与导出',
    route: '/markdown',
    tag: 'v1.0',
  },
  {
    icon: '🧾',
    name: 'JSON 编辑器',
    description: '格式化、校验与预览 JSON 数据，错误定位一目了然',
    route: '/json',
    tag: 'v1.0',
  },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">工具集合</h1>
      <p class="mt-1 text-muted-foreground">选择一个工具开始使用</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ToolCard
        v-for="tool in tools"
        :key="tool.route"
        v-bind="tool"
      />
      <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center opacity-60">
        <span class="mb-3 text-4xl">➕</span>
        <h3 class="text-base font-semibold">更多工具</h3>
        <p class="mt-1 text-sm text-muted-foreground">即将上线</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Home page with tool cards"
```

---

### Task 8: Build Markdown utility library

**Files:**
- Create: `src/lib/markdown.ts`

- [ ] **Step 1: Create src/lib/markdown.ts**

```ts
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="not-prose"><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // fall through
      }
    }
    return `<pre class="not-prose"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

export function renderMarkdown(source: string): string {
  return md.render(source)
}

export function renderMarkdownSafe(source: string): string {
  if (!source) return '<p style="color: var(--muted-foreground)">输入 Markdown 文本开始预览...</p>'
  return renderMarkdown(source)
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Markdown parsing library with highlight.js"
```

---

### Task 9: Build Markdown tool page

**Files:**
- Create: `src/views/Markdown.vue`

- [ ] **Step 1: Create src/views/Markdown.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { renderMarkdownSafe } from '@/lib/markdown'
import 'highlight.js/styles/github.css'

const router = useRouter()
const input = ref('')

const previewHtml = computed(() => renderMarkdownSafe(input.value))

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'
  inputEl.accept = '.md,.markdown'
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      input.value = reader.result as string
    }
    reader.readAsText(file)
  }
  inputEl.click()
}

function handleExport() {
  const blob = new Blob([input.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'document.md'
  a.click()
  URL.revokeObjectURL(url)
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(input.value)
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">Markdown 编辑器</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleCopy"
        >
          复制
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleImport"
        >
          导入
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="handleExport"
        >
          导出
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          ✏️ 编辑
        </div>
        <textarea
          v-model="input"
          placeholder="在此输入 Markdown..."
          class="min-h-[400px] w-full resize-none bg-transparent p-4 font-mono text-sm outline-none"
        />
      </div>
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览
        </div>
        <div
          class="prose prose-sm dark:prose-invert min-h-[400px] w-full p-4 max-w-none"
          v-html="previewHtml"
        />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Markdown tool page with edit/preview split"
```

---

### Task 10: Build JSON utility library

**Files:**
- Create: `src/lib/json.ts`

- [ ] **Step 1: Create src/lib/json.ts**

```ts
export interface JsonValidationResult {
  valid: boolean
  error: string | null
  parsed: unknown | null
}

export function validateJson(input: string): JsonValidationResult {
  if (!input.trim()) {
    return { valid: true, error: null, parsed: null }
  }
  try {
    const parsed = JSON.parse(input)
    return { valid: true, error: null, parsed }
  } catch (e) {
    return { valid: false, error: (e as Error).message, parsed: null }
  }
}

export function formatJson(input: string, indent: number = 2): string {
  const parsed = JSON.parse(input)
  return JSON.stringify(parsed, null, indent)
}

export function compressJson(input: string): string {
  const parsed = JSON.parse(input)
  return JSON.stringify(parsed)
}

export function syntaxHighlightJson(obj: unknown, depth: number = 0): string {
  if (obj === null) return '<span class="json-null">null</span>'
  if (obj === undefined) return ''

  const indent = '  '
  const pad = (n: number) => indent.repeat(n)

  if (typeof obj === 'string') {
    return `<span class="json-string">"${escapeHtml(obj)}"</span>`
  }
  if (typeof obj === 'number') {
    return `<span class="json-number">${obj}</span>`
  }
  if (typeof obj === 'boolean') {
    return `<span class="json-boolean">${obj}</span>`
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '<span class="json-bracket">[ ]</span>'
    const items = obj.map((item) =>
      `${pad(depth + 1)}${syntaxHighlightJson(item, depth + 1)}`
    ).join(',\n')
    return `[\n${items}\n${pad(depth)}]`
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>)
    if (keys.length === 0) return '<span class="json-bracket">{ }</span>'
    const items = keys.map((key) => {
      const value = (obj as Record<string, unknown>)[key]
      return `${pad(depth + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${syntaxHighlightJson(value, depth + 1)}`
    }).join(',\n')
    return `{\n${items}\n${pad(depth)}}`
  }

  return String(obj)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add JSON utility library with format/validate/highlight"
```

---

### Task 11: Build JSON tool page

**Files:**
- Create: `src/views/Json.vue`

- [ ] **Step 1: Create src/views/Json.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { validateJson, formatJson, compressJson, syntaxHighlightJson } from '@/lib/json'

const router = useRouter()
const input = ref('')
const error = ref<string | null>(null)
const parsed = ref<unknown>(null)

const highlightedHtml = computed(() => {
  if (parsed.value === null || parsed.value === undefined) {
    return '<span class="text-muted-foreground">输入 JSON 数据开始预览...</span>'
  }
  return syntaxHighlightJson(parsed.value)
})

const stats = computed(() => {
  if (!input.value.trim()) {
    return { lines: 0, chars: 0, bytes: 0 }
  }
  return {
    lines: input.value.split('\n').length,
    chars: input.value.length,
    bytes: new Blob([input.value]).size,
  }
})

function handleFormat() {
  if (!input.value.trim()) return
  try {
    input.value = formatJson(input.value)
    error.value = null
    parsed.value = JSON.parse(input.value)
  } catch (e) {
    error.value = (e as Error).message
  }
}

function handleCompress() {
  if (!input.value.trim()) return
  try {
    input.value = compressJson(input.value)
    error.value = null
    parsed.value = JSON.parse(input.value)
  } catch (e) {
    error.value = (e as Error).message
  }
}

function handleValidate() {
  if (!input.value.trim()) {
    error.value = null
    parsed.value = null
    return
  }
  const result = validateJson(input.value)
  if (result.valid) {
    error.value = null
    parsed.value = result.parsed
  } else {
    error.value = result.error
    parsed.value = null
  }
}

function handleImport() {
  const inputEl = document.createElement('input')
  inputEl.type = 'file'
  inputEl.accept = '.json'
  inputEl.onchange = () => {
    const file = inputEl.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      input.value = reader.result as string
      handleValidate()
    }
    reader.readAsText(file)
  }
  inputEl.click()
}

function handleExport() {
  const blob = new Blob([input.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(input.value)
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        @click="router.push('/')"
      >
        ← 返回
      </button>
      <span class="text-muted-foreground">|</span>
      <h2 class="text-lg font-semibold">JSON 编辑器</h2>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleCopy"
        >
          复制
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="handleImport"
        >
          导入
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          @click="handleExport"
        >
          导出
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <button
        class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        @click="handleFormat"
      >
        格式化
      </button>
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="handleCompress"
      >
        压缩
      </button>
      <div class="h-5 w-px bg-border" />
      <button
        class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="handleValidate"
      >
        校验
      </button>
    </div>

    <div v-if="error" class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>⚠️</span>
      <span>{{ error }}</span>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          ✏️ 编辑
        </div>
        <textarea
          v-model="input"
          placeholder="输入 JSON 数据..."
          class="min-h-[400px] w-full resize-none bg-transparent p-4 font-mono text-sm outline-none"
        />
      </div>
      <div class="flex flex-col rounded-lg border">
        <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          👁️ 预览
        </div>
        <div
          class="min-h-[400px] w-full p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
          v-html="highlightedHtml"
        />
      </div>
    </div>

    <div class="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span v-if="error === null && parsed !== null">✓ 校验通过</span>
      <span v-else-if="error">✗ 校验失败</span>
      <span v-else>等待输入</span>
      <span>
        行数: {{ stats.lines }} | 字符数: {{ stats.chars }} | 大小: {{ stats.bytes }} B
      </span>
    </div>
  </div>
</template>

<style scoped>
.json-key { color: #2563eb; }
.json-string { color: #059669; }
.json-number { color: #d97706; }
.json-boolean { color: #c026d3; }
.json-null { color: #94a3b8; }
.json-bracket { color: #64748b; }

:root.dark .json-key { color: #60a5fa; }
:root.dark .json-string { color: #34d399; }
:root.dark .json-number { color: #fbbf24; }
:root.dark .json-boolean { color: #c084fc; }
:root.dark .json-null { color: #64748b; }
:root.dark .json-bracket { color: #94a3b8; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add JSON tool page with format/validate/tree preview"
```

---

### Task 12: Add global styles for JSON syntax colors

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add JSON syntax highlight styles to global CSS**

Append to `src/style.css`:

```css
/* JSON syntax highlighting */
.json-key { color: #2563eb; }
.json-string { color: #059669; }
.json-number { color: #d97706; }
.json-boolean { color: #c026d3; }
.json-null { color: #94a3b8; }
.json-bracket { color: #64748b; }

.dark .json-key { color: #60a5fa; }
.dark .json-string { color: #34d399; }
.dark .json-number { color: #fbbf24; }
.dark .json-boolean { color: #c084fc; }
.dark .json-null { color: #64748b; }
.dark .json-bracket { color: #94a3b8; }
```

Then remove the scoped `<style>` block from `src/views/Json.vue` since these styles are now global.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "style: move JSON syntax colors to global CSS for dark mode support"
```

---

### Task 13: Build and verify

**Files:**
- Verify: `vite.config.ts`, all source files

- [ ] **Step 1: Run build to verify no errors**

Run: `npm run build`
Expected: `vue-tsc --noEmit` passes, `vite build` succeeds, output in `dist/`

- [ ] **Step 2: Fix any build errors**

If there are type errors or build errors, fix them.

- [ ] **Step 3: Commit final build fix**

```bash
git add -A
git commit -m "chore: fix build errors and verify production build"
```