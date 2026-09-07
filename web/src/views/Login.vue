<template>
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
    <AmbientBackground />
    <!-- decorative gradient blobs -->
    <div class="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl"></div>
    <div class="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl"></div>

    <div class="relative w-full max-w-md">
      <div class="text-center mb-8">
        <div class="inline-flex w-14 h-14 rounded-2xl gradient-bg items-center justify-center shadow-lift mb-4">
          <Printer class="w-7 h-7 text-white" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">欢迎回来</h1>
        <p class="mt-2 text-muted-foreground">登录以继续你的造物之旅</p>
      </div>

      <div class="rounded-2xl border border-border bg-card p-8 shadow-soft">
        <form @submit.prevent="submit" class="space-y-5">
          <div class="space-y-2">
            <Label for="username">邮箱 / 账号</Label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="username" v-model="form.username" placeholder="请输入注册邮箱" class="pl-10" />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="password">密码</Label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                v-model="form.password"
                :type="showPwd ? 'text' : 'password'"
                placeholder="请输入密码"
                class="pl-10 pr-10"
                @keyup.enter="submit"
              />
              <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" @click="showPwd = !showPwd">
                <Eye v-if="!showPwd" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="flex justify-end">
            <button type="button" class="text-sm text-primary hover:underline" @click="showForgot = true">忘记密码？</button>
          </div>

          <Button type="submit" variant="gradient" size="lg" class="w-full" :disabled="loading">
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? '登录中...' : '登 录' }}
          </Button>
        </form>

        <div class="mt-6 text-center text-sm text-muted-foreground">
          还没有账号？
          <router-link to="/register" class="text-primary font-medium hover:underline">立即注册</router-link>
        </div>

        <div v-if="!userStore.isLoggedIn" class="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2.5">
          <Info class="w-3.5 h-3.5 shrink-0" />
          <span>测试管理员账号：admin / admin123</span>
        </div>
      </div>
    </div>

    <!-- 忘记密码弹窗 -->
    <Teleport to="body">
      <div v-if="showForgot" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="closeForgot">
        <div class="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
          <div class="p-6">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-xl font-semibold">重置密码</h3>
              <button class="text-muted-foreground hover:text-foreground" @click="closeForgot">
                <X class="w-5 h-5" />
              </button>
            </div>
            <div class="space-y-4">
              <div class="space-y-2">
                <Label>注册邮箱</Label>
                <Input v-model="forgotForm.email" placeholder="请输入注册邮箱" />
              </div>
              <div class="space-y-2">
                <Label>邮箱验证码</Label>
                <div class="flex gap-3">
                  <Input v-model="forgotForm.code" placeholder="6 位验证码" class="flex-1" />
                  <Button type="button" variant="outline" :disabled="forgotCountdown > 0 || sendingCode" @click="sendForgotCode">
                    <Loader2 v-if="sendingCode" class="w-4 h-4 animate-spin mr-1" />
                    {{ forgotCountdown > 0 ? `${forgotCountdown}s` : '获取验证码' }}
                  </Button>
                </div>
              </div>
              <div class="space-y-2">
                <Label>新密码</Label>
                <Input v-model="forgotForm.newPassword" type="password" placeholder="至少 6 位" />
              </div>
              <div class="space-y-2">
                <Label>确认新密码</Label>
                <Input v-model="forgotForm.confirmPassword" type="password" placeholder="再次输入新密码" />
              </div>
            </div>
            <div class="mt-6">
              <Button variant="gradient" size="lg" class="w-full" :disabled="resetting" @click="submitForgot">
                <Loader2 v-if="resetting" class="w-4 h-4 animate-spin" />
                {{ resetting ? '提交中...' : '重置密码' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Printer, User, Lock, Eye, EyeOff, Loader2, Info, X } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import { sendCode, resetPassword } from '@/api'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const loading = ref(false)
const showPwd = ref(false)
const form = reactive({ username: '', password: '' })

// ===== 忘记密码 =====
const showForgot = ref(false)
const forgotForm = reactive({ email: '', code: '', newPassword: '', confirmPassword: '' })
const sendingCode = ref(false)
const forgotCountdown = ref(0)
const resetting = ref(false)

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function submit() {
  if (!form.username || !form.password) {
    toast.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    toast.success('登录成功')
    const redirect = (route.query.redirect as string) || (userStore.isAdmin ? '/admin' : '/orders')
    router.push(redirect)
  } finally {
    loading.value = false
  }
}

function closeForgot() {
  showForgot.value = false
  forgotForm.email = ''
  forgotForm.code = ''
  forgotForm.newPassword = ''
  forgotForm.confirmPassword = ''
}

async function sendForgotCode() {
  if (!emailRegex.test(forgotForm.email)) return toast.warning('请输入正确的邮箱地址')
  sendingCode.value = true
  try {
    await sendCode(forgotForm.email)
    toast.success('验证码已发送至邮箱，请查收')
    forgotCountdown.value = 60
    const timer = setInterval(() => {
      forgotCountdown.value--
      if (forgotCountdown.value <= 0) clearInterval(timer)
    }, 1000)
  } finally {
    sendingCode.value = false
  }
}

async function submitForgot() {
  if (!emailRegex.test(forgotForm.email)) return toast.warning('请输入正确的邮箱地址')
  if (!forgotForm.code) return toast.warning('请输入验证码')
  if (forgotForm.newPassword.length < 6) return toast.warning('新密码至少 6 位')
  if (forgotForm.newPassword !== forgotForm.confirmPassword) return toast.warning('两次新密码不一致')
  resetting.value = true
  try {
    await resetPassword(forgotForm.email, forgotForm.code, forgotForm.newPassword)
    toast.success('密码重置成功，请使用新密码登录')
    closeForgot()
  } finally {
    resetting.value = false
  }
}
</script>
