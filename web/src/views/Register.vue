<template>
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 relative overflow-hidden">
    <AmbientBackground />
    <div class="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl"></div>
    <div class="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl"></div>

    <div class="relative w-full max-w-md">
      <div class="text-center mb-8">
        <div class="inline-flex w-14 h-14 rounded-2xl gradient-bg items-center justify-center shadow-lift mb-4">
          <UserPlus class="w-7 h-7 text-white" />
        </div>
        <h1 class="text-3xl font-bold tracking-tight">创建账号</h1>
        <p class="mt-2 text-muted-foreground">用邮箱注册，加入创影3D</p>
      </div>

      <div class="rounded-2xl border border-border bg-card p-8 shadow-soft">
        <form @submit.prevent="submit" class="space-y-5">
          <div class="space-y-2">
            <Label for="email">邮箱 <span class="text-destructive">*</span></Label>
            <SpotlightInput id="email" v-model="form.email" type="email" placeholder="your@email.com" />
          </div>

          <div class="space-y-2">
            <Label for="code">验证码 <span class="text-destructive">*</span></Label>
            <div class="flex gap-3">
              <SpotlightInput id="code" v-model="form.code" placeholder="6 位验证码" class="flex-1" />
              <Button type="button" variant="outline" :disabled="countdown > 0 || sendingCode" @click="sendCode">
                <Loader2 v-if="sendingCode" class="w-4 h-4 animate-spin mr-1" />
                {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">验证码将发送至您的邮箱，5 分钟内有效</p>
          </div>

          <div class="space-y-2">
            <Label for="password">密码 <span class="text-destructive">*</span></Label>
            <SpotlightInput id="password" v-model="form.password" type="password" placeholder="至少 6 位字符" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="realName">真实姓名</Label>
              <SpotlightInput id="realName" v-model="form.realName" placeholder="选填" />
            </div>
            <div class="space-y-2">
              <Label for="studentNo">学号</Label>
              <SpotlightInput id="studentNo" v-model="form.studentNo" placeholder="选填" />
            </div>
          </div>

          <Button type="submit" variant="gradient" size="lg" class="w-full" :disabled="loading">
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? '注册中...' : '注 册' }}
          </Button>
        </form>

        <div class="mt-6 text-center text-sm text-muted-foreground">
          已有账号？
          <router-link to="/login" class="text-primary font-medium hover:underline">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { UserPlus, Loader2 } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import { sendCode as sendCodeApi } from '@/api'
import SpotlightInput from '@/components/ui/SpotlightInput.vue'
import Label from '@/components/ui/Label.vue'
import Button from '@/components/ui/Button.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const form = reactive({ email: '', code: '', password: '', realName: '', studentNo: '' })

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function sendCode() {
  if (!emailRegex.test(form.email)) return toast.warning('请输入正确的邮箱地址')
  sendingCode.value = true
  try {
    await sendCodeApi(form.email)
    toast.success('验证码已发送至邮箱，请查收')
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } finally {
    sendingCode.value = false
  }
}

async function submit() {
  if (!emailRegex.test(form.email)) return toast.warning('请输入正确的邮箱地址')
  if (form.code.length < 4) return toast.warning('请输入验证码')
  if (form.password.length < 6) return toast.warning('密码至少 6 位')
  loading.value = true
  try {
    await userStore.register({
      email: form.email,
      code: form.code,
      password: form.password,
      realName: form.realName || undefined,
      studentNo: form.studentNo || undefined,
    })
    toast.success('注册成功')
    router.push('/orders')
  } finally {
    loading.value = false
  }
}
</script>
