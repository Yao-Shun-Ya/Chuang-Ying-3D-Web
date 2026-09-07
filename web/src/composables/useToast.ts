import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  type: ToastType
  message: string
}

const state = reactive<{ toasts: Toast[] }>({ toasts: [] })
let counter = 0

function push(type: ToastType, message: string, duration = 3000) {
  const id = ++counter
  state.toasts.push({ id, type, message })
  setTimeout(() => {
    const idx = state.toasts.findIndex((t) => t.id === id)
    if (idx > -1) state.toasts.splice(idx, 1)
  }, duration)
}

export const toast = {
  success: (m: string) => push('success', m),
  error: (m: string) => push('error', m),
  info: (m: string) => push('info', m),
  warning: (m: string) => push('warning', m),
}

export function useToasts() {
  return { toasts: state.toasts }
}
