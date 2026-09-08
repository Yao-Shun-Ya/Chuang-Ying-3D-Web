import axios from 'axios'
import { toast } from '@/composables/useToast'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截：附带 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：统一错误提示
request.interceptors.response.use(
  (res) => {
    // blob 响应直接返回
    if (res.config.responseType === 'blob') return res.data
    // 统一响应格式 { code, data, msg }，提取 data
    return res.data?.data
  },
  (error) => {
    const status = error.response?.status
    const body = error.response?.data
    const msg = body?.msg || error.message || '请求失败'

    // 公开接口（登录/注册/验证码/重置密码）的 401 是"凭证错误"，只需提示，不跳转
    const url: string = error.config?.url || ''
    const isPublicAuth =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/send-code') ||
      url.includes('/auth/reset-password')

    if (status === 401 && !isPublicAuth) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else if (status === 429) {
      toast.warning('操作过于频繁，请稍后再试')
    } else {
      toast.error(Array.isArray(msg) ? msg.join('；') : msg)
    }
    return Promise.reject(error)
  },
)

export default request
