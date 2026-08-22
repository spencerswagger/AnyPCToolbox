/// <reference types="vite/client" />

declare const __APP_VERSION__: string

// 补充 TS lib.dom 缺失的 File System Access API 类型（文件重命名功能使用）
interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
interface DataTransferItem {
  getAsFileSystemHandle(): Promise<FileSystemHandle | null>
}
interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}
interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: string
}
