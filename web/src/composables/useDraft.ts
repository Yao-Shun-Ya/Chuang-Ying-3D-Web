import { ref, watch, onMounted } from 'vue'

/**
 * 表单草稿自动保存到 localStorage
 * @param key localStorage 键名
 * @param data 要保存的响应式数据
 * @param autoSave 是否自动保存（默认 true）
 */
export function useDraft<T extends Record<string, unknown>>(key: string, data: T, autoSave = true) {
  const STORAGE_KEY = `draft:${key}`
  const restored = ref(false)

  // 保存草稿
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  // 恢复草稿
  function restore(): T | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as T
        Object.assign(data, parsed)
        restored.value = true
        return parsed
      }
    } catch {
      // 解析失败时忽略
    }
    return null
  }

  // 清除草稿
  function clear() {
    localStorage.removeItem(STORAGE_KEY)
    restored.value = false
  }

  // 挂载时恢复
  onMounted(() => {
    restore()
  })

  // 自动保存（debounce 500ms）
  if (autoSave) {
    let timer: ReturnType<typeof setTimeout>
    watch(
      data,
      () => {
        clearTimeout(timer)
        timer = setTimeout(save, 500)
      },
      { deep: true },
    )
  }

  return { save, restore, clear, restored }
}
