declare module '@tauri-apps/plugin-updater' {
  export interface Update {
    version: string
    currentVersion: string
    date: string
    body?: string
    downloadUrl?: string
    downloadAndInstall(onProgress?: (progress: { chunkLength: number }) => void): Promise<void>
    close(): Promise<void>
  }

  export function checkUpdate(): Promise<Update | null>
}

declare module '@tauri-apps/plugin-shell' {
  export function exec(command: string, args?: string[]): Promise<{ stdout: string; stderr: string; code: number }>
}
