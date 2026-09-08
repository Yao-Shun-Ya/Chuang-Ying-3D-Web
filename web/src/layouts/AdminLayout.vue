<template>
  <div class="min-h-screen flex flex-col bg-background">
    <header class="sticky top-0 z-40 glass border-b border-border/60 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-2.5 cursor-pointer group" @click="$router.push('/admin')">
          <div class="relative w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-lift group-hover:scale-105 transition-transform">
            <Printer class="w-5 h-5 text-white" />
          </div>
          <span class="text-lg font-bold tracking-tight">创影<span class="gradient-text">3D</span> · 管理后台</span>
        </div>

        <div class="flex-1"></div>

        <!-- 退出按钮 -->
        <Button variant="destructive" size="sm" @click="handleLogout">
          <LogOut class="w-4 h-4 mr-1.5" /> 退出登录
        </Button>
      </div>
    </header>

    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Printer, LogOut } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const userStore = useUserStore()

function handleLogout() {
  userStore.logout()
  router.push('/')
}

onMounted(() => {
  if (userStore.token && !userStore.user) userStore.fetchProfile()
})
</script>
