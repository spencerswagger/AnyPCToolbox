# AnyPCToolbox 多端自动更新 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AnyPCToolbox（Web + Tauri 桌面端 6 平台）实现完整的自动更新链路：Web 版 SW 缓存换版本 + 刷新，桌面版 tauri-plugin-updater 公钥验签更新，CI 推 tag 后产出全部更新制品。

**Architecture:** 版本真源为 `package.json` / `src-tauri/tauri.conf.json`（两者必须一致），构建时由 Vite `define` 注入 `__APP_VERSION__`。更新检测统一在 `src/composables/useUpdate.ts`：Web 走 `fetch /version.json`（no-store）+ 语义化比较 + SW `SKIP_WAITING` 换缓存刷新；Tauri 走 `tauri-plugin-updater` 的 `check() → downloadAndInstall()`。CI（`.github/workflows/release.yml`）三个 job：`generate-updater-json`（生成 version.json 并创建 draft Release）、`publish-tauri`（6 平台矩阵 + Ed25519 签名）、`upload-web`（web zip）。

**Tech Stack:** Vue 3 + Vite 6 + TypeScript、Workbox 风格原生 Service Worker（无依赖）、Tauri v2（tauri-plugin-updater v2）、GitHub Actions（tauri-action@v0、softprops/action-gh-release@v2）。

**分支：** 所有工作在 `trae/agent-BvLJbV` 分支上完成（从 `main` 创建）。

---

## 前置背景（给零上下文的实施者）

- 仓库：AnyPCToolbox，Vue3 + Vite + TS + Tailwind 前端，`src-tauri/` 为 Tauri v2 壳（目前只挂了 opener 插件）。
- 已有 `.github/workflows/release.yml`：仅一个 `publish-tauri` job（6 平台矩阵、无签名、无 updater、无 web 制品）。
- 无测试框架（package.json 无 test script），本计划用 `npx vue-tsc --noEmit`、`npm run build`、`cargo check`、直接运行 node 脚本作为验证手段。
- 版本号出现在两处且必须同步：`package.json` 的 `version`、`src-tauri/tauri.conf.json` 的 `version`。发版 = 同时改这两处 → 打 tag。

## 文件结构总览

| 文件 | 动作 | 职责 |
|---|---|---|
| `vite.config.ts` | 修改 | 构建时注入 `__APP_VERSION__` |
| `env.d.ts` | 修改 | 声明 `__APP_VERSION__` 全局常量 |
| `scripts/generate-update-artifacts.js` | 新建 | 从 tag 生成 `version.json` + 三处版本一致性校验 |
| `src/composables/useUpdate.ts` | 新建 | 统一更新调度（状态机、轮询、版本比较、applyUpdate 双端分支） |
| `public/sw.js` | 新建 | 按版本命名的 SW 缓存 + 新版本激活清旧缓存 |
| `src/main.ts` | 修改 | 生产环境注册 SW（带 `?v=` 版本参数，Tauri 内跳过） |
| `src/components/UpdateBanner.vue` | 新建 | 顶部非侵入更新横幅 |
| `src/components/UpdateManager.vue` | 新建 | 全屏更新对话框（版本对比 / 更新日志 / 下载进度） |
| `src/components/AppLayout.vue` | 修改 | 挂载横幅与对话框 |
| `src/App.vue` | 修改 | 启动/停止更新轮询 |
| `src-tauri/Cargo.toml` | 修改 | 加 `tauri-plugin-updater` |
| `src-tauri/src/lib.rs` | 修改 | 注册 updater 插件 |
| `src-tauri/capabilities/default.json` | 修改 | 加 `updater:default` 权限 |
| `src-tauri/tauri.conf.json` | 修改 | `createUpdaterArtifacts` + `plugins.updater` 配置 |
| `.github/workflows/release.yml` | 修改 | 三 job：generate-updater-json / publish-tauri（+签名）/ upload-web |
| `.gitignore` | 修改 | 忽略 `dist-version/` |
| `package.json` / `package-lock.json` | 修改 | 加 `@tauri-apps/api`、`@tauri-apps/plugin-updater` |

---

### Task 1: 分支、依赖与版本号注入

**Files:**
- Create: 分支 `trae/agent-BvLJbV`
- Modify: `package.json`、`package-lock.json`（npm install 自动）
- Modify: `vite.config.ts`
- Modify: `env.d.ts`

- [ ] **Step 1: 创建工作分支**

```bash
git checkout -b trae/agent-BvLJbV
```

- [ ] **Step 2: 安装 updater 前端依赖**

```bash
npm install @tauri-apps/api@^2.9.0 @tauri-apps/plugin-updater@^2.9.0
```

预期：package.json dependencies 出现两个 `@tauri-apps/*` 包，lockfile 更新。（版本号以 registry 实际 latest v2 为准，`^2` 即可。）

- [ ] **Step 3: 修改 `vite.config.ts`，注入 `__APP_VERSION__`**

完整新内容：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
})
```

- [ ] **Step 4: 修改 `env.d.ts`，声明全局常量**

完整新内容：

```ts
/// <reference types="vite/client" />

declare const __APP_VERSION__: string
```

- [ ] **Step 5: 类型检查验证**

Run: `npx vue-tsc --noEmit`
Expected: 无输出（通过）。注意 `tsconfig.node.json` 单独覆盖 vite.config.ts，`__dirname` 用法为仓库既有写法，不动。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts env.d.ts
git commit -m "feat(update): 注入 __APP_VERSION__ 并接入 updater 前端依赖"
```

---

### Task 2: 版本制品生成脚本

**Files:**
- Create: `scripts/generate-update-artifacts.js`
- Modify: `.gitignore`（追加 `dist-version/`）

- [ ] **Step 1: 创建 `scripts/generate-update-artifacts.js`**

完整内容：

```js
#!/usr/bin/env node
/**
 * 从 git tag 生成 Web 端版本清单 version.json。
 * 同时校验 tag 与 package.json / src-tauri/tauri.conf.json 版本一致，不一致直接失败。
 *
 * 用法：node scripts/generate-update-artifacts.js v1.0.1
 * 输出：dist-version/version.json（含 version / buildTime / notes）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? ''

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`[generate-update-artifacts] 无效 tag: "${tag}"（期望形如 v1.2.3）`)
  process.exit(1)
}
const version = tag.replace(/^v/, '')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const tauriConf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))

for (const [file, v] of [
  ['package.json', pkg.version],
  ['src-tauri/tauri.conf.json', tauriConf.version],
]) {
  if (v !== version) {
    console.error(
      `[generate-update-artifacts] 版本不一致: tag=${version}，但 ${file} 中为 ${v}。` +
        '发版前请同步更新这两处版本号。',
    )
    process.exit(1)
  }
}

const manifest = {
  version,
  buildTime: new Date().toISOString(),
  notes: process.env.RELEASE_NOTES ?? '',
}

const outDir = resolve(root, 'dist-version')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`[generate-update-artifacts] 已生成 dist-version/version.json (v${version})`)
```

- [ ] **Step 2: 运行验证（正反两例）**

```bash
node scripts/generate-update-artifacts.js v1.0.0
```
Expected: 输出 `已生成 dist-version/version.json (v1.0.0)`（当前仓库版本是 1.0.0）。

```bash
node scripts/generate-update-artifacts.js v9.9.9 ; echo "exit=$?"
```
Expected: stderr 输出版本不一致错误，`exit=1`。

- [ ] **Step 3: `.gitignore` 追加一行 `dist-version/`**（若不存在）

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-update-artifacts.js .gitignore
git commit -m "feat(update): 新增 version.json 生成脚本与版本一致性校验"
```

---

### Task 3: 统一更新调度 useUpdate.ts

**Files:**
- Create: `src/composables/useUpdate.ts`

模块级单例状态（与仓库 `useTheme.ts` 同模式）。状态机：`idle → checking → available → downloading → ready`，另有 `latest` / `error`。

- [ ] **Step 1: 创建 `src/composables/useUpdate.ts`**

完整内容：

```ts
import { ref } from 'vue'
import type { Update } from '@tauri-apps/plugin-updater'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'latest'
  | 'error'

export interface DownloadProgress {
  downloaded: number
  contentLength: number
}

const isTauri = '__TAURI_INTERNALS__' in window
const currentVersion = __APP_VERSION__
const CHECK_INTERVAL_MS = 5 * 60 * 1000
const STARTUP_DELAY_MS = 3000

const status = ref<UpdateStatus>('idle')
const latestVersion = ref('')
const releaseNotes = ref('')
const buildTime = ref('')
const errorMessage = ref('')
const progress = ref<DownloadProgress>({ downloaded: 0, contentLength: 0 })
const showManager = ref(false)

let startupTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined
let pendingTauriUpdate: Update | null = null

/** 语义化版本比较：a > b 返回 1，a < b 返回 -1，相等返回 0 */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  const pb = b
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

interface VersionManifest {
  version: string
  buildTime?: string
  notes?: string
}

async function checkWebUpdate(): Promise<void> {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as VersionManifest
  if (compareVersions(data.version, currentVersion) > 0) {
    latestVersion.value = data.version
    releaseNotes.value = data.notes ?? ''
    buildTime.value = data.buildTime ?? ''
    status.value = 'available'
  } else {
    status.value = 'latest'
  }
}

async function checkTauriUpdate(): Promise<void> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (update) {
    pendingTauriUpdate = update
    latestVersion.value = update.version
    releaseNotes.value = update.body ?? ''
    status.value = 'available'
  } else {
    pendingTauriUpdate = null
    status.value = 'latest'
  }
}

async function checkForUpdate(): Promise<void> {
  status.value = 'checking'
  try {
    if (isTauri) {
      await checkTauriUpdate()
    } else {
      await checkWebUpdate()
    }
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

/** Web：通知 SW SKIP_WAITING 后随 controllerchange 刷新；Tauri：下载并安装 */
async function applyUpdate(): Promise<void> {
  if (isTauri) {
    const update = pendingTauriUpdate
    if (!update || status.value !== 'available') return
    status.value = 'downloading'
    try {
      let contentLength = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0
            progress.value = { downloaded: 0, contentLength }
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            progress.value = { downloaded, contentLength }
            break
          case 'Finished':
            progress.value = { downloaded: contentLength, contentLength }
            break
        }
      })
      status.value = 'ready'
    } catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
    return
  }

  const reg = await navigator.serviceWorker.getRegistration()
  if (reg?.waiting) {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => window.location.reload(),
      { once: true },
    )
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  } else {
    window.location.reload()
  }
}

/** 启动延迟首查 + 每 5 分钟轮询 */
function startUpdatePolling(): void {
  if (startupTimer || pollTimer) return
  startupTimer = setTimeout(() => {
    void checkForUpdate()
    pollTimer = setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS)
  }, STARTUP_DELAY_MS)
}

function stopUpdatePolling(): void {
  if (startupTimer) clearTimeout(startupTimer)
  if (pollTimer) clearInterval(pollTimer)
  startupTimer = undefined
  pollTimer = undefined
}

export function useUpdate() {
  return {
    isTauri,
    currentVersion,
    status,
    latestVersion,
    releaseNotes,
    buildTime,
    errorMessage,
    progress,
    showManager,
    checkForUpdate,
    applyUpdate,
    startUpdatePolling,
    stopUpdatePolling,
  }
}
```

- [ ] **Step 2: 类型检查验证**

Run: `npx vue-tsc --noEmit`
Expected: 通过（`Update` 类型来自 Task 1 安装的插件包）。

- [ ] **Step 3: Commit**

```bash
git add src/composables/useUpdate.ts
git commit -m "feat(update): 统一更新调度 composable（Web 轮询 + Tauri updater）"
```

---

### Task 4: Service Worker 与注册

**Files:**
- Create: `public/sw.js`
- Modify: `src/main.ts`

关键设计：SW 不经过 Vite 构建，版本号从注册 URL 的 `?v=` 参数读取（`main.ts` 用 `__APP_VERSION__` 拼 URL）。每次发版注册 URL 变化 → 浏览器安装新 SW → 新 SW 等待（不自动接管）→ 用户确认后主线程发 `SKIP_WAITING` → 激活并删除旧版本缓存 → `controllerchange` → 页面刷新。

- [ ] **Step 1: 创建 `public/sw.js`**

完整内容：

```js
/* AnyPCToolbox Service Worker
 * 版本来源：注册 URL 的 ?v= 参数（main.ts 注入 __APP_VERSION__）
 * 策略：HTML 网络优先、version.json 永不缓存、静态资源缓存优先；
 *       新版本激活时清理所有旧版本缓存。
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || '0.0.0'
const CACHE_NAME = `anypctoolbox-${VERSION}`

self.addEventListener('install', () => {
  // 不自动 skipWaiting：等主线程确认新版本后发 SKIP_WAITING 消息
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/version.json') return // 版本清单始终直连，不进缓存
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    /\.(js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|wasm)$/.test(pathname)
  )
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' })
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, fresh.clone())
    }
    return fresh
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const root = await caches.match('/')
    return root || Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  if (fresh.ok && fresh.type === 'basic') {
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, fresh.clone())
  }
  return fresh
}
```

- [ ] **Step 2: 修改 `src/main.ts`（注册 SW）**

完整新内容：

```ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

const isTauri = '__TAURI_INTERNALS__' in window
if (
  import.meta.env.PROD &&
  !isTauri &&
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register(`/sw.js?v=${__APP_VERSION__}`)
    .catch((err) => console.warn('[update] Service Worker 注册失败:', err))
}
```

说明：Tauri 内跳过注册（webview 协议非 http 且更新走 updater 插件）；`?v=` 参数保证每次发版产生新 SW 实例。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: vue-tsc 与 vite build 均通过；`dist/sw.js` 存在（Vite 原样拷贝 public/）。

- [ ] **Step 4: Commit**

```bash
git add public/sw.js src/main.ts
git commit -m "feat(update): 版本化 Service Worker 缓存与注册"
```

---

### Task 5: 更新 UI（横幅 + 全屏对话框）

**Files:**
- Create: `src/components/UpdateBanner.vue`
- Create: `src/components/UpdateManager.vue`
- Modify: `src/components/AppLayout.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: 创建 `src/components/UpdateBanner.vue`**

完整内容：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useUpdate } from '@/composables/useUpdate'

const { status, latestVersion, applyUpdate, showManager, isTauri } = useUpdate()
const dismissed = ref(false)
</script>

<template>
  <Transition name="update-banner">
    <div
      v-if="status === 'available' && !dismissed"
      class="sticky top-14 z-40 flex items-center justify-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm"
    >
      <span class="font-medium text-primary">发现新版本 v{{ latestVersion }}</span>
      <button
        v-if="!isTauri"
        class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        @click="applyUpdate"
      >
        立即更新
      </button>
      <button
        v-else
        class="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        @click="showManager = true"
      >
        查看详情
      </button>
      <button
        class="text-muted-foreground transition-colors hover:text-foreground"
        title="本次忽略"
        aria-label="忽略更新提示"
        @click="dismissed = true"
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style>
.update-banner-enter-active,
.update-banner-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.update-banner-enter-from,
.update-banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
```

- [ ] **Step 2: 创建 `src/components/UpdateManager.vue`**

完整内容：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useUpdate } from '@/composables/useUpdate'

const {
  status,
  currentVersion,
  latestVersion,
  releaseNotes,
  buildTime,
  errorMessage,
  progress,
  showManager,
  applyUpdate,
  isTauri,
} = useUpdate()

const percent = computed(() => {
  const { downloaded, contentLength } = progress.value
  if (!contentLength) return 0
  return Math.min(100, Math.round((downloaded / contentLength) * 100))
})

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(1)} ${units[i]}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="update-overlay">
      <div
        v-if="showManager"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="应用更新"
      >
        <div class="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl">
          <h2 class="text-lg font-semibold">发现新版本</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            v{{ currentVersion }}
            <span class="mx-1">→</span>
            <span class="font-medium text-primary">v{{ latestVersion }}</span>
          </p>
          <p v-if="buildTime" class="mt-1 text-xs text-muted-foreground">
            发布于 {{ new Date(buildTime).toLocaleString() }}
          </p>

          <div
            v-if="releaseNotes"
            class="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm"
          >{{ releaseNotes }}</div>

          <div v-if="status === 'downloading'" class="mt-4">
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${percent}%` }"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ percent }}% · {{ formatBytes(progress.downloaded) }} /
              {{ formatBytes(progress.contentLength) }}
            </p>
          </div>

          <p
            v-if="status === 'ready'"
            class="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
          >
            更新已安装，应用即将重启；若未自动重启，请手动重新打开。
          </p>
          <p
            v-if="status === 'error'"
            class="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            更新失败：{{ errorMessage }}
          </p>

          <div class="mt-6 flex justify-end gap-2">
            <button
              v-if="status === 'available' || status === 'error'"
              class="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent"
              @click="showManager = false"
            >
              稍后提醒
            </button>
            <button
              v-if="status === 'available' || status === 'error'"
              class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              @click="applyUpdate"
            >
              {{ isTauri ? '下载并安装' : '刷新页面更新' }}
            </button>
            <button
              v-if="status === 'downloading' || status === 'ready'"
              disabled
              class="cursor-not-allowed rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground opacity-50"
            >
              {{ status === 'downloading' ? '更新中…' : '完成' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.update-overlay-enter-active,
.update-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.update-overlay-enter-from,
.update-overlay-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 3: 修改 `src/components/AppLayout.vue`**

script 部分新增导入：

```ts
import UpdateBanner from './UpdateBanner.vue'
import UpdateManager from './UpdateManager.vue'
```

template 中 `</header>` 之后、`<main` 之前插入：

```html
    <UpdateBanner />
```

`</main>` 之后（回到顶部按钮的 Transition 之前或之后均可，放在其后）插入：

```html
    <UpdateManager />
```

- [ ] **Step 4: 修改 `src/App.vue`（启动轮询）**

完整新内容：

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useUpdate } from '@/composables/useUpdate'

const { startUpdatePolling, stopUpdatePolling } = useUpdate()

onMounted(startUpdatePolling)
onUnmounted(stopUpdatePolling)
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>
```

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 通过（注意 tsconfig 开了 `noUnusedLocals`，不要留下未用导入）。

- [ ] **Step 6: Commit**

```bash
git add src/components/UpdateBanner.vue src/components/UpdateManager.vue src/components/AppLayout.vue src/App.vue
git commit -m "feat(update): 更新横幅与全屏更新对话框"
```

---

### Task 6: Tauri updater 插件接入

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: `Cargo.toml` 的 `[dependencies]` 追加**

```toml
tauri-plugin-updater = "2"
```

- [ ] **Step 2: `src-tauri/src/lib.rs` 注册插件**

完整新内容：

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: `capabilities/default.json` 的 permissions 数组追加 `"updater:default"`**

```json
  "permissions": [
    "core:default",
    "opener:default",
    "updater:default"
  ]
```

- [ ] **Step 4: `tauri.conf.json`：`bundle` 加 `createUpdaterArtifacts`，新增 `plugins.updater`**

`"bundle"` 节改为：

```json
  "bundle": {
    "active": true,
    "createUpdaterArtifacts": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
```

顶层追加（与 `bundle` 平级）：

```json
  "plugins": {
    "updater": {
      "endpoints": [
        "https://updates.anypctoolbox.example.com/updater.json"
      ],
      "pubkey": "REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY",
      "dialog": false
    }
  }
```

说明：
- `dialog: false`——更新 UI 由 UpdateManager.vue 自己做，不用插件内置弹窗。
- `endpoints` 域名与 `pubkey` 是占位值，发版前必须替换（见文末「上线前清单」）。
- Tauri v2 的超时通过 JS `check()` 的 options 控制（若插件类型定义支持），配置文件内不放 `timeout` 键（v2 schema 不认）。

- [ ] **Step 5: 验证前端 + Rust 侧**

Run: `npm run build`（前端不应受影响）
Run: `cd src-tauri && cargo check`
Expected: cargo check 通过（需要网络拉取 crate；若沙箱无法访问 crates.io，记录原因跳过，该项在 CI 会再验证）。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tauri.conf.json
git commit -m "feat(update): 接入 tauri-plugin-updater（验签更新 + updater 制品）"
```

---

### Task 7: CI 工作流改造（三 job）

**Files:**
- Modify: `.github/workflows/release.yml`

job 依赖关系：`generate-updater-json` 最先跑（创建 draft Release 并上传 version.json），`publish-tauri` 与 `upload-web` 都 `needs` 它——避免三个 job 并发创建 Release 的竞态。

- [ ] **Step 1: 重写 `.github/workflows/release.yml`**

完整新内容：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  # 1. 生成 version.json 并创建 draft Release（后续 job 向同一 draft 追加制品）
  generate-updater-json:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Generate version.json
        run: node scripts/generate-update-artifacts.js "${GITHUB_REF_NAME}"

      - name: Upload version.json
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          draft: true
          files: dist-version/version.json

  # 2. 六平台桌面构建 + Updater 签名
  publish-tauri:
    needs: generate-updater-json
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            target: x86_64-apple-darwin
            args: '--target x86_64-apple-darwin'
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            args: '--target x86_64-pc-windows-msvc'
          - platform: windows-latest
            target: aarch64-pc-windows-msvc
            args: '--target aarch64-pc-windows-msvc'
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            args: '--target x86_64-unknown-linux-gnu'
          - platform: ubuntu-22.04-arm
            target: aarch64-unknown-linux-gnu
            args: '--target aarch64-unknown-linux-gnu'
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            xdg-utils

      - name: Install frontend dependencies
        run: npm ci

      - name: Build and upload Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: ${{ github.ref_name }}
          releaseDraft: true
          includeUpdaterJson: true
          args: ${{ matrix.args }}

  # 3. Web 静态资源打包上传
  upload-web:
    needs: generate-updater-json
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build web
        run: npm run build

      - name: Package web dist
        run: |
          VERSION="${GITHUB_REF_NAME#v}"
          cd dist
          zip -r "../anypctoolbox-web-v${VERSION}.zip" .

      - name: Upload web zip
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          draft: true
          files: anypctoolbox-web-v*.zip
```

说明：
- `TAURI_SIGNING_PRIVATE_KEY` 存在时，tauri-action 自动给安装包生成 `.sig` 并产出 `latest.json` updater 清单（配合 Task 6 的 `createUpdaterArtifacts: true`）。
- `latest.json` 部署到服务器时改名为 `updater.json`。

- [ ] **Step 2: 语法自检**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/release.yml','utf8'); console.log(y.includes('generate-updater-json')&&y.includes('upload-web')&&y.includes('TAURI_SIGNING_PRIVATE_KEY')?'workflow ok':'missing sections')"`
Expected: `workflow ok`。（YAML 完整语法由 CI 执行时验证。）

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): 三 job 产出版本清单/签名桌面包/web 制品"
```

---

### Task 8: 全量验证与收尾

- [ ] **Step 1: 全量构建**

```bash
npm run build
```
Expected: vue-tsc + vite build 通过。

- [ ] **Step 2: Rust 检查（若 Task 6 未跑通）**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 3: 提交历史核对**

```bash
git log --oneline main..trae/agent-BvLJbV
```
Expected: 7 个左右提交，覆盖上述全部文件。

- [ ] **Step 4: 不推送分支**——是否 push / 建 PR 由用户决定。

---

## 上线前清单（部署与密钥，人工操作）

1. **生成 Ed25519 签名密钥对**（本地，无需开发者账号）：
   ```bash
   npx tauri signer generate -w ~/.tauri/anypctoolbox-updater.key
   ```
   - 私钥内容（含密码，若有）→ GitHub Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，并离线备份私钥文件。
   - 公钥输出 → 替换 `src-tauri/tauri.conf.json` 中 `plugins.updater.pubkey` 的占位值。
2. **替换 endpoints 域名**：`https://updates.anypctoolbox.example.com/updater.json` → 实际服务器地址。
3. **服务器手动部署**（每次发版，从 Release API 下载制品）：
   - `/var/www/web/` ← 解压 `anypctoolbox-web-vX.Y.Z.zip` + 放入 `version.json` + 放入 `updater.json`（即 Release 里的 `latest.json` 改名）。
   - `/var/www/releases/vX.Y.Z/` ← 全部桌面安装包与 `.sig` 文件。
4. **发版流程**：同步改 `package.json` 与 `src-tauri/tauri.conf.json` 版本 → commit → `git tag vX.Y.Z && git push --tags` → CI 产出 draft Release → 人工核对后 publish → 手动部署服务器。
