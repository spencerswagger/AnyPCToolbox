import { ref, computed } from 'vue'
import type { MobileUpdateInfo } from '@/types/update'

interface MobileUpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  currentVersion: string
  latestVersion: string
  downloadProgress: number
  errorMessage: string
  updateInfo: MobileUpdateInfo | null
}

const state = ref<MobileUpdateState>({
  status: 'idle',
  currentVersion: __APP_VERSION__,
  latestVersion: '',
  downloadProgress: 0,
  errorMessage: '',
  updateInfo: null,
})

let mobileUpdateUrl = ''

export function configureMobileUpdate(options: { updateUrl?: string }) {
  if (options.updateUrl) mobileUpdateUrl = options.updateUrl
}

async function fetchMobileUpdateInfo(): Promise<MobileUpdateInfo | null> {
  if (!mobileUpdateUrl) return null

  try {
    const response = await fetch(`${mobileUpdateUrl}/mobile-update.json`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
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

export async function checkMobileUpdate(): Promise<boolean> {
  if (state.value.status === 'checking') return false

  state.value.status = 'checking'
  state.value.errorMessage = ''

  try {
    const info = await fetchMobileUpdateInfo()
    if (!info) {
      state.value.status = 'idle'
      return false
    }

    const hasUpdate = compareVersions(info.version, state.value.currentVersion) > 0
    if (hasUpdate) {
      state.value.latestVersion = info.version
      state.value.updateInfo = info
      state.value.status = 'available'
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

export function installMobileUpdate() {
  const info = state.value.updateInfo
  if (!info) return

  state.value.status = 'downloading'

  if ('__TAURI_MOBILE__' in window) {
    window.location.href = info.downloadUrl
  } else {
    alert(`请前往应用商店下载最新版本 v${info.version}`)
  }
}

export function useMobileUpdate() {
  const status = computed(() => state.value.status)
  const currentVersion = computed(() => state.value.currentVersion)
  const latestVersion = computed(() => state.value.latestVersion)
  const downloadProgress = computed(() => state.value.downloadProgress)
  const errorMessage = computed(() => state.value.errorMessage)
  const updateInfo = computed(() => state.value.updateInfo)
  const hasUpdate = computed(() => state.value.status === 'available')

  return {
    status,
    currentVersion,
    latestVersion,
    downloadProgress,
    errorMessage,
    updateInfo,
    hasUpdate,
    checkMobileUpdate,
    installMobileUpdate,
  }
}
