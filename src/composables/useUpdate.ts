import { ref, onMounted, onUnmounted, computed } from 'vue'

export interface VersionInfo {
  version: string
  buildTime: string
  notes: string
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  latestVersion: string
  downloadProgress: number
  errorMessage: string
}

const state = ref<UpdateState>({
  status: 'idle',
  currentVersion: __APP_VERSION__,
  latestVersion: '',
  downloadProgress: 0,
  errorMessage: '',
})

let versionFileUrl = '/version.json'
let checkInterval: number | null = null
let onUpdateAvailableCallbacks: Array<(info: VersionInfo) => void> = []
let currentUpdate: {
  version: string
  date?: string
  body?: string
  download: (onEvent?: (event: { event: string; data: any }) => void) => Promise<void>
  install: () => Promise<void>
} | null = null

const isTauri = __TAURI__

export function configureUpdate(options: {
  versionFileUrl?: string
  checkIntervalMs?: number
}) {
  if (options.versionFileUrl) versionFileUrl = options.versionFileUrl
  if (options.checkIntervalMs && checkInterval === null) {
    checkInterval = window.setInterval(() => checkForUpdate(), options.checkIntervalMs)
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.')
  const partsB = b.replace(/^v/, '').split('.')
  const length = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < length; i++) {
    const numA = parseInt(partsA[i] || '0', 10)
    const numB = parseInt(partsB[i] || '0', 10)
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

async function checkWebUpdate(): Promise<boolean> {
  try {
    const response = await fetch(versionFileUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!response.ok) return false
    const info = await response.json() as VersionInfo

    const hasUpdate = compareVersions(info.version, state.value.currentVersion) > 0
    if (hasUpdate) {
      state.value.latestVersion = info.version
      state.value.status = 'available'
      onUpdateAvailableCallbacks.forEach((cb) => cb(info))
      return true
    }

    state.value.status = 'idle'
    return false
  } catch {
    state.value.status = 'idle'
    return false
  }
}

async function checkTauriUpdate(): Promise<boolean> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (update) {
      currentUpdate = update
      state.value.latestVersion = update.version
      state.value.status = 'available'
      onUpdateAvailableCallbacks.forEach((cb) => cb({
        version: update.version,
        buildTime: update.date || '',
        notes: update.body || '',
      }))
      return true
    }
    state.value.status = 'idle'
    return false
  } catch {
    state.value.status = 'idle'
    return false
  }
}

export async function checkForUpdate(): Promise<boolean> {
  if (state.value.status === 'checking' || state.value.status === 'downloading') {
    return false
  }

  state.value.status = 'checking'
  state.value.errorMessage = ''

  if (isTauri) {
    return checkTauriUpdate()
  }
  return checkWebUpdate()
}

async function handleDownloadEvent(event: { event: string; data: any }) {
  if (event.event === 'Progress') {
    state.value.downloadProgress = event.data.chunkLength
  }
}

export async function applyUpdate() {
  if (isTauri && currentUpdate) {
    try {
      state.value.status = 'downloading'
      await currentUpdate.download(handleDownloadEvent)
      await currentUpdate.install()
      state.value.status = 'ready'
    } catch (err: unknown) {
      state.value.status = 'error'
      state.value.errorMessage = err instanceof Error ? err.message : '更新失败'
    }
  } else {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          if (registration.waiting) {
            registration.waiting.postMessage('SKIP_WAITING')
          }
          registration.update()
        })
      })
    }
    window.location.reload()
  }
}

export function onUpdateAvailable(callback: (info: VersionInfo) => void) {
  onUpdateAvailableCallbacks.push(callback)
  return () => {
    onUpdateAvailableCallbacks = onUpdateAvailableCallbacks.filter((cb) => cb !== callback)
  }
}

export function useUpdate() {
  const updateStatus = computed(() => state.value.status)
  const currentVersion = computed(() => state.value.currentVersion)
  const latestVersion = computed(() => state.value.latestVersion)
  const downloadProgress = computed(() => state.value.downloadProgress)
  const errorMessage = computed(() => state.value.errorMessage)
  const hasUpdate = computed(() => state.value.status === 'available')

  onMounted(() => {
    if (checkInterval === null) {
      checkInterval = window.setInterval(() => checkForUpdate(), 5 * 60 * 1000)
    }
    checkForUpdate()
  })

  onUnmounted(() => {
    if (checkInterval !== null) {
      window.clearInterval(checkInterval)
      checkInterval = null
    }
  })

  return {
    updateStatus,
    currentVersion,
    latestVersion,
    downloadProgress,
    errorMessage,
    hasUpdate,
    checkForUpdate,
    applyUpdate,
  }
}
