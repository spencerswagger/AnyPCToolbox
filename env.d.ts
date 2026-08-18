/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_BUILD_TIME__: string
declare const __TAURI__: boolean
declare const __TAURI_MOBILE__: boolean

interface Window {
  __TAURI__?: boolean
  __TAURI_MOBILE__?: boolean
}
