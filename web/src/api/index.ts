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

// ===== 订单 =====
export const createOrder = (modelId: number, remark?: string, scale: number = 1) =>
  request.post('/orders', { modelId, remark, scale })

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

// 状态流转（管理员）
export const updateOrderStatus = (id: number, status: string, remark?: string) =>
  request.post(`/orders/${id}/status`, { status, remark })
