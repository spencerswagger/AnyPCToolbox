import { ref } from 'vue'

export interface ToastItem {
  id: string
  title?: string
  description?: string
  open: boolean
}

const TOAST_LIMIT = 3
const AUTO_DISMISS_MS = 2500

const toasts = ref<ToastItem[]>([])
let seed = 0

function dismiss(id: string): void {
  const t = toasts.value.find((x) => x.id === id)
  if (!t || !t.open) return
  t.open = false
  window.setTimeout(() => {
    const i = toasts.value.findIndex((x) => x.id === id)
    if (i >= 0) toasts.value.splice(i, 1)
  }, 200)
}

function toast(title?: string, description?: string): void {
  const id = `${Date.now()}_${++seed}`
  toasts.value.push({ id, title, description, open: true })
  if (toasts.value.length > TOAST_LIMIT) dismiss(toasts.value[0].id)
  window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
}

export function useToaster() {
  return { toasts, dismiss, toast }
}

export { toasts, dismiss }