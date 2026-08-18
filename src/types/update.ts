export interface TauriUpdaterPlugin {
  checkUpdate(): Promise<TauriUpdate | null>
  downloadAndInstall(onProgress?: (progress: TauriUpdateProgress) => void): Promise<void>
  close(): Promise<void>
}

export interface TauriUpdate {
  version: string
  currentVersion: string
  date: string
  body?: string
  downloadUrl?: string
}

export interface TauriUpdateProgress {
  chunkLength: number
  totalChunkLength?: number
}

export interface TauriMobileUpdater {
  checkForUpdate(): Promise<MobileUpdateInfo | null>
  installUpdate(url: string): Promise<void>
}

export interface MobileUpdateInfo {
  version: string
  downloadUrl: string
  notes?: string
  isMandatory?: boolean
}

export interface UpdateConfig {
  versionFileUrl: string
  checkIntervalMs: number
  forceUpdate: boolean
}
