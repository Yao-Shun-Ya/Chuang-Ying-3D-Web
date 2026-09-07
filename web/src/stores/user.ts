import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, register as apiRegister, getProfile } from '@/api'

export interface UserInfo {
  id: number
  username: string
  email: string
  role: 'student' | 'admin'
  realName?: string
  studentNo?: string
  displayName?: string
  avatar?: string
  balance: number
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
    return res
  }

  async function register(data: any) {
    const res = await apiRegister(data)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
    return res
  }

  async function fetchProfile() {
    if (!token.value) return
    try {
      user.value = await getProfile()
    } catch {
      logout()
    }
  }

  function setBalance(b: number) {
    if (user.value) user.value.balance = b
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  return { token, user, isLoggedIn, isAdmin, login, register, fetchProfile, setBalance, logout }
})
