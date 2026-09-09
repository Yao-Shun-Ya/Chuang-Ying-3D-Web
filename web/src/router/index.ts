import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/Home.vue') },
      { path: 'help', name: 'help', component: () => import('@/views/Help.vue') },
      { path: 'faq', name: 'faq', component: () => import('@/views/FAQ.vue') },
      { path: 'pickup', name: 'pickup', component: () => import('@/views/Pickup.vue') },
      { path: 'login', name: 'login', component: () => import('@/views/Login.vue') },
      { path: 'register', name: 'register', component: () => import('@/views/Register.vue') },
      // 学生端
      { path: 'balance', name: 'balance', component: () => import('@/views/student/Balance.vue'), meta: { requiresAuth: true } },
      { path: 'upload', name: 'upload', component: () => import('@/views/student/Upload.vue'), meta: { requiresAuth: true } },
      { path: 'print-config', name: 'print-config', component: () => import('@/views/student/PrintConfig.vue'), meta: { requiresAuth: true } },
      { path: 'orders', name: 'orders', component: () => import('@/views/student/Orders.vue'), meta: { requiresAuth: true } },
      { path: 'devices', name: 'devices', component: () => import('@/views/student/DeviceStatus.vue'), meta: { requiresAuth: true } },
      { path: 'laser', name: 'laser', component: () => import('@/views/student/Laser.vue'), meta: { requiresAuth: true } },
      { path: 'account', name: 'account', component: () => import('@/views/student/Account.vue'), meta: { requiresAuth: true } },
    ],
  },
  // 管理员端：独立布局
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('@/views/admin/Dashboard.vue') },
      { path: 'cdk', name: 'admin-cdk', component: () => import('@/views/admin/CdkManage.vue') },
      { path: 'orders', name: 'admin-orders', component: () => import('@/views/admin/OrderReview.vue') },
      { path: 'transactions', name: 'admin-transactions', component: () => import('@/views/admin/Transactions.vue') },
      { path: 'users', name: 'admin-users', component: () => import('@/views/admin/Users.vue') },
      { path: 'devices', name: 'admin-devices', component: () => import('@/views/admin/Devices.vue') },
      { path: 'laser', name: 'admin-laser', component: () => import('@/views/admin/LaserManage.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.token) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  // 有 token 但未加载用户资料时，先拉取资料再判断角色
  if (userStore.token && !userStore.user) {
    try {
      await userStore.fetchProfile()
    } catch {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
  }
  if (to.meta.role && userStore.user?.role !== to.meta.role) {
    next({ name: 'home' })
  } else {
    next()
  }
})

export default router
