<template>
  <div class="min-h-screen flex flex-col bg-background">
    <!-- Header -->
    <header
      :class="[
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        scrolled ? 'glass border-b border-border/60 shadow-sm' : 'bg-transparent',
      ]"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-2.5 cursor-pointer group shrink-0" @click="$router.push('/')">
          <div class="relative w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lift group-hover:scale-105 transition-transform">
            <Printer class="w-5 h-5 text-white" />
          </div>
          <span class="text-lg font-bold tracking-tight">创影<span class="gradient-text">3D</span></span>
        </div>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-1 ml-2">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="relative px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            {{ item.label }}
            <span
              class="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-0 gradient-bg rounded-full transition-all duration-300 group-hover:w-2/3"
              :class="{ 'w-2/3': isActive(item.path) }"
            ></span>
          </router-link>
        </nav>

        <div class="flex-1"></div>

        <!-- User area (desktop) -->
        <div class="hidden md:flex items-center gap-3">
          <template v-if="userStore.isLoggedIn">
            <DropdownMenu align="end">
              <template #trigger>
                <div class="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card/70 hover:bg-card cursor-pointer transition-all hover:shadow-soft">
                  <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" class="w-8 h-8 rounded-full object-cover" />
                  <div v-else class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-sm font-bold">
                    {{ (userStore.user?.displayName || userStore.user?.username || '?').charAt(0).toUpperCase() }}
                  </div>
                  <span class="text-sm font-medium">{{ userStore.user?.displayName || userStore.user?.username }}</span>
                  <ChevronDown class="w-4 h-4 text-muted-foreground" />
                </div>
              </template>
              <DropdownItem @click="goAccount">
                <User class="w-4 h-4" /> 账号管理
              </DropdownItem>
              <DropdownItem @click="handleLogout">
                <LogOut class="w-4 h-4" /> 退出登录
              </DropdownItem>
            </DropdownMenu>
          </template>
          <template v-else>
            <Button variant="ghost" @click="$router.push('/login')">登录</Button>
            <Button variant="gradient" @click="$router.push('/register')">注册</Button>
          </template>
        </div>

        <!-- Mobile menu button -->
        <button
          class="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          @click="mobileOpen = !mobileOpen"
        >
          <Menu v-if="!mobileOpen" class="w-5 h-5" />
          <X v-else class="w-5 h-5" />
        </button>
      </div>

      <!-- Mobile menu -->
      <Transition name="dropdown">
        <div v-if="mobileOpen" class="md:hidden border-t border-border glass">
          <div class="px-4 py-4 space-y-1">
            <router-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
              @click="mobileOpen = false"
            >
              {{ item.label }}
            </router-link>
            <div class="pt-3 mt-3 border-t border-border">
              <template v-if="userStore.isLoggedIn">
                <div class="flex items-center gap-2 px-3 py-2 mb-1">
                  <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" class="w-8 h-8 rounded-full object-cover" />
                  <div v-else class="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-sm font-bold">
                    {{ (userStore.user?.displayName || userStore.user?.username || '?').charAt(0).toUpperCase() }}
                  </div>
                  <span class="text-sm font-medium">{{ userStore.user?.displayName || userStore.user?.username }}</span>
                </div>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                  @click="goAccount"
                >
                  <User class="w-4 h-4" /> 账号管理
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  @click="handleLogout"
                >
                  <LogOut class="w-4 h-4" /> 退出登录
                </button>
              </template>
              <template v-else>
                <div class="grid grid-cols-2 gap-2">
                  <Button variant="outline" @click="$router.push('/login'); mobileOpen = false">登录</Button>
                  <Button variant="gradient" @click="$router.push('/register'); mobileOpen = false">注册</Button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <!-- Main -->
    <main class="flex-1 pt-16">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="footer-wrap">
      <!-- 顶部渐变分隔线 -->
      <div class="footer-wave"></div>

      <!-- 大文字背景层（绝对定位，不挡点击） -->
      <div class="footer-bigtext">
        <TextHoverEffect text="CHUANGYING 3D" />
      </div>

      <div class="footer-inner">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-5 gap-8">
          <!-- 品牌区 -->
          <div class="md:col-span-2 footer-brand">
            <div class="flex items-center gap-2.5 mb-4">
              <div class="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lift footer-logo">
                <Printer class="w-5 h-5 text-white" />
              </div>
              <span class="text-lg font-bold text-slate-800">创影<span class="gradient-text">3D</span></span>
            </div>
            <p class="text-sm text-slate-500 max-w-md leading-relaxed mb-4">
              校内封闭式 3D 打印服务，让创意触手可及。上传模型、在线计价、自助下单，一站式完成你的造物之旅。
            </p>
            <div class="flex gap-2">
              <span class="footer-tag">STL</span>
              <span class="footer-tag">OBJ</span>
              <span class="footer-tag">3MF</span>
            </div>
          </div>

          <!-- 快速导航 -->
          <div class="footer-col">
            <h4 class="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-800">
              <span class="w-1 h-4 rounded-full gradient-bg"></span>
              快速导航
            </h4>
            <ul class="space-y-2.5 text-sm">
              <li><router-link to="/help" class="footer-link">使用帮助</router-link></li>
              <li><router-link to="/faq" class="footer-link">常见问题</router-link></li>
              <li><router-link to="/pickup" class="footer-link">取件须知</router-link></li>
            </ul>
          </div>

          <!-- 关于 -->
          <div class="footer-col">
            <h4 class="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-800">
              <span class="w-1 h-4 rounded-full gradient-bg"></span>
              关于
            </h4>
            <ul class="space-y-2.5 text-sm text-slate-500">
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                川北医学院 · 创影工作室
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-accent/60"></span>
                © 2026 黄宇普 · 川北医学院 · 用代码解剖世界. All Rights Reserved.
              </li>
            </ul>
          </div>

          <!-- 联系 -->
          <div class="footer-col">
            <h4 class="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-800">
              <span class="w-1 h-4 rounded-full gradient-bg"></span>
              联系
            </h4>
            <ul class="space-y-2.5 text-sm">
              <li class="flex items-center gap-2 text-slate-500">
                <MessageCircle class="w-4 h-4 text-primary" />
                <span>QQ：2720356281</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 开源链接行 -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 pb-6 text-center">
          <a
            href="https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Github class="w-3.5 h-3.5" />
            本项目已经开源 https://github.com/Yao-Shun-Ya/Chuang-Ying-3D-Web（点此进入）
          </a>
        </div>

        <!-- 底部细条 -->
        <div class="footer-bottom">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-slate-400">
            <span>Crafted with ❤ · 3D Printing Self-Service Platform</span>
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              服务运行中
            </span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Printer, ChevronDown, LogOut, Menu, X, User, MessageCircle, Github } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownItem from '@/components/ui/DropdownItem.vue'
import TextHoverEffect from '@/components/effects/TextHoverEffect.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const scrolled = ref(false)
const mobileOpen = ref(false)

// 导航顺序（学生登录后）：首页 → 使用帮助 → 常见问题 → 取件须知 → 上传模型 → 激光工坊 → 我的订单 → 设备状态 → 余额充值
const publicNav = [
  { path: '/', label: '首页' },
  { path: '/help', label: '使用帮助' },
  { path: '/faq', label: '常见问题' },
  { path: '/pickup', label: '取件须知' },
]
const studentNav = [
  { path: '/upload', label: '上传模型' },
  { path: '/laser', label: '激光工坊' },
  { path: '/orders', label: '我的订单' },
  { path: '/devices', label: '设备状态' },
  { path: '/balance', label: '余额充值' },
]

const navItems = computed(() => {
  const items = [...publicNav]
  if (userStore.isLoggedIn && !userStore.isAdmin) {
    items.push(...studentNav)
  }
  return items
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function onScroll() {
  scrolled.value = window.scrollY > 12
}

function handleLogout() {
  userStore.logout()
  mobileOpen.value = false
  router.push('/')
}

function goAccount() {
  mobileOpen.value = false
  router.push('/account')
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  if (userStore.token && !userStore.user) userStore.fetchProfile()
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>
