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

async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(versionFileUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function checkForUpdate(): Promise<boolean> {
  if (state.value.status === 'checking' || state.value.status === 'downloading') {
    return false
  }

  state.value.status = 'checking'
  state.value.errorMessage = ''

  try {
    const info = await fetchVersionInfo()
    if (!info) {
      state.value.status = 'idle'
      return false
    }

    const hasUpdate = compareVersions(info.version, state.value.currentVersion) > 0
    if (hasUpdate) {
      state.value.latestVersion = info.version
      state.value.status = 'available'
      onUpdateAvailableCallbacks.forEach((cb) => cb(info))
      return true
    }

    state.value.status = 'idle'
    return false
  } catch (err: unknown) {
    state.value.status = 'error'
    state.value.errorMessage = err instanceof Error ? err.message : '未知错误'
    return false
  }
}

export function applyUpdate() {
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
