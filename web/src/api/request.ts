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
  (res) => res.data,
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    toast.error(Array.isArray(msg) ? msg.join('；') : msg)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default request
