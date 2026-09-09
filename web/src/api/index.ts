import request from './request'

// ===== 认证 =====
export const login = (username: string, password: string) =>
  request.post('/auth/login', { username, password })

export const sendCode = (email: string) => request.post('/auth/send-code', { email })

export const register = (data: { email: string; code: string; password: string; realName?: string; studentNo?: string }) =>
  request.post('/auth/register', data)

export const getProfile = () => request.get('/auth/me')

export const updateProfile = (data: { realName?: string; studentNo?: string; displayName?: string; avatar?: string }) =>
  request.patch('/auth/me', data)

export const changePassword = (code: string, newPassword: string) =>
  request.post('/auth/change-password', { code, newPassword })

export const resetPassword = (email: string, code: string, newPassword: string) =>
  request.post('/auth/reset-password', { email, code, newPassword })

export const changeAdminPasswordByKey = (keyContent: string, newPassword: string) =>
  request.post('/auth/admin/change-password', { keyContent, newPassword })

export const uploadAvatar = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return request.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ===== CDK & 余额 =====
export const generateCdk = (value: number, count: number) =>
  request.post('/cdk/generate', { value, count })

export const redeemCdk = (code: string) => request.post('/cdk/redeem', { code })

export const getBalance = () => request.get('/cdk/balance')

export const getMyTransactions = () => request.get('/cdk/transactions')

export const listCdk = (status?: string) => request.get('/cdk', { params: { status } })

// ===== 模型 =====
export const uploadModel = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return request.post('/models/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getMyModels = () => request.get('/models')

export const getModelFileUrl = (id: number) => `/api/models/${id}/file`

/** 公开耗材配置（计价参数：密度/单价/默认填充率） */
export const getMaterialConfig = () => request.get('/config/material')

// ===== 订单 =====
export interface PrintOrderOptions {
  deviceId?: string
  infillRate?: number
  supports?: number
  color?: string
}

export const createOrder = (
  modelId: number,
  remark?: string,
  scale: number = 1,
  print?: PrintOrderOptions,
) => request.post('/orders', { modelId, remark, scale, ...print })

export const getMyOrders = () => request.get('/orders/mine')

export const getOrderDetail = (id: number) => request.get(`/orders/${id}`)

export const getOrderLogs = (id: number) => request.get(`/orders/${id}/logs`)

// ===== 管理员 =====
export const listAllOrders = (status?: string) =>
  request.get('/admin/orders', { params: { status } })

export const approveOrder = (id: number) => request.post(`/admin/orders/${id}/approve`)

export const rejectOrder = (id: number, reason: string) =>
  request.post(`/admin/orders/${id}/reject`, { reason })

export const listUsers = () => request.get('/admin/users')

export const listAllTransactions = () => request.get('/admin/transactions')

export const exportTransactions = () =>
  request.get('/admin/transactions/export', { responseType: 'blob' })

// 状态流转（管理员，printerDeviceId 为开始打印时绑定的打印机）
export const updateOrderStatus = (id: number, status: string, remark?: string, printerDeviceId?: string) =>
  request.post(`/orders/${id}/status`, { status, remark, printerDeviceId })

// ===== 设备（学生/登录用户）=====
export const getPublicDevices = () => request.get('/devices/public')

// ===== 设备（管理端）=====
export const listDevices = () => request.get('/admin/devices')

export const testAllDevices = () => request.post('/admin/devices/test')

export const testDevice = (id: string) => request.post(`/admin/devices/${id}/test`)

export const sendDeviceCommand = (id: string, command: string) =>
  request.post(`/admin/devices/${id}/command`, { command })

export const toggleDevice = (id: string) => request.post(`/admin/devices/${id}/toggle`)

export const setDeviceManualState = (id: string, state: string | null) =>
  request.post(`/admin/devices/${id}/manual-state`, { state })

export const getDeviceEvents = (id: string, limit = 50) =>
  request.get(`/admin/devices/${id}/events`, { params: { limit } })

export const reloadDeviceConfig = () => request.post('/admin/devices/reload')

// ===== 设备（管理端）新增/删除与管理 =====
export interface AddDevicePayload {
  id?: string
  name?: string
  type: string
  category: string
  model?: string
  host: string
  accessCode?: string
  serial?: string
  mqttPort?: number
  wsPort?: number
  restPort?: number
  probePort?: number
  pricePerMinute?: number
  description?: string
}

export const addDevice = (payload: AddDevicePayload) => request.post('/admin/devices', payload)

export const removeDevice = (id: string) => request.delete(`/admin/devices/${id}`)

/** 驱动注册表目录（选品牌 → 选型号 → 自动带出参数模板 + 支持指令） */
export const getDeviceRegistry = () => request.get('/admin/device-registry')

// ===== 激光工坊（学生端）=====
export const getLaserDevices = () => request.get('/laser/devices')

export const createLaserSession = (data: { deviceId: string; plannedMinutes: number; purpose?: string }) =>
  request.post('/laser/sessions', data)

export const getMyLaserSessions = () => request.get('/laser/sessions/my')

export const startLaserSession = (data: { deviceId?: string; code?: string }) =>
  request.post('/laser/sessions/start', data)

export const endLaserSession = (id: number) => request.post(`/laser/sessions/${id}/end`)

export const cancelLaserSession = (id: number) => request.post(`/laser/sessions/${id}/cancel`)

// ===== 激光工坊（管理端）=====
export const listLaserSessions = (status?: string) =>
  request.get('/admin/laser/sessions', { params: { status } })

export const getLaserStats = () => request.get('/admin/laser/stats')

export const approveLaserSession = (id: number) => request.post(`/admin/laser/sessions/${id}/approve`)

export const rejectLaserSession = (id: number, reason: string) =>
  request.post(`/admin/laser/sessions/${id}/reject`, { reason })

export const forceEndLaserSession = (id: number) => request.post(`/admin/laser/sessions/${id}/end`)
