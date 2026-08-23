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
      // 安装完成后延迟片刻让 UI 展示"已安装"，再强制拉起新版本进程
      setTimeout(() => {
        void (async () => {
          try {
            const { relaunch } = await import('@tauri-apps/plugin-process')
            await relaunch()
          } catch (err) {
            errorMessage.value = err instanceof Error ? err.message : String(err)
            status.value = 'error'
          }
        })()
      }, 800)
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
