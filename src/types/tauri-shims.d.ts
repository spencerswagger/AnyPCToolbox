declare module '@tauri-apps/plugin-updater' {
  export interface Update {
    readonly version: string
    readonly currentVersion: string
    readonly date?: string
    readonly body?: string
    readonly rawJson: Record<string, unknown>
    available: boolean
    download(onEvent?: (event: { event: string; data: any }) => void): Promise<void>
    install(): Promise<void>
    downloadAndInstall(onEvent?: (event: { event: string; data: any }) => void): Promise<void>
    close(): Promise<void>
  }

  export interface CheckOptions {
    headers?: HeadersInit
    timeout?: number
    proxy?: string
    target?: string
    allowDowngrades?: boolean
  }

  export interface DownloadOptions {
    headers?: HeadersInit
    timeout?: number
  }

  export interface DownloadEvent {
    event: string
    data: any
  }

  export function check(options?: CheckOptions): Promise<Update | null>
}

declare module '@tauri-apps/plugin-shell' {
  export function exec(command: string, args?: string[]): Promise<{ stdout: string; stderr: string; code: number }>
}
