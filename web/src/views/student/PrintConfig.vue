<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">打印配置</h1>
      <p class="text-muted-foreground mt-1">挑选设备 → 配置打印参数与耗材 → 确认下单</p>
    </div>

    <ListSkeleton v-if="loading" :columns="2" :rows="4" />

    <template v-else-if="model">
      <!-- 模型信息 -->
      <div class="rounded-2xl border border-border bg-card shadow-soft p-6 mb-6">
        <h3 class="text-lg font-semibold flex items-center gap-2 mb-4">
          <Package class="w-5 h-5 text-primary" /> 模型信息
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground mb-1">模型</p>
            <p class="font-medium truncate" :title="model.original_name">{{ model.original_name }}</p>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground mb-1">缩放倍数</p>
            <p class="font-medium">{{ scale }}x</p>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground mb-1">打印体积</p>
            <p class="font-medium">{{ scaledVolume }} cm³</p>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground mb-1">格式</p>
            <p class="font-medium uppercase">{{ model.format }}</p>
          </div>
        </div>
      </div>

      <!-- ① 选择设备 -->
      <div class="rounded-2xl border border-border bg-card shadow-soft p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Printer class="w-5 h-5 text-sky-600" /> ① 选择打印设备
            <span class="text-sm text-muted-foreground font-normal">指定执行任务的机器</span>
          </h3>
          <Button variant="ghost" size="sm" @click="loadDevices">
            <RefreshCw class="w-4 h-4" /> 刷新
          </Button>
        </div>

        <div v-if="!devices.length" class="py-8 text-center text-muted-foreground">
          <Printer class="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p class="text-sm">暂无可用打印设备，请联系管理员接入设备后再提交订单</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="d in devices" :key="d.id"
            @click="deviceId = d.id"
            :class="[
              'rounded-xl border p-4 text-left transition-all',
              deviceId === d.id ? 'border-primary bg-primary/5 shadow-soft' : 'border-border hover:border-primary/40',
            ]"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                  <Printer class="w-4.5 h-4.5 text-sky-600" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ d.name }}</p>
                  <p class="text-xs text-muted-foreground truncate">{{ d.model || '3D 打印机' }}</p>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <Badge :variant="d.online ? 'success' : 'secondary'">
                <span class="w-1.5 h-1.5 rounded-full mr-1" :class="d.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'"></span>
                {{ d.online ? '在线' : '离线' }}
              </Badge>
              <Badge :variant="d.state === 'idle' ? 'info' : d.state === 'working' ? 'warning' : 'secondary'">
                {{ stateLabel(d.state) }}
              </Badge>
              <Badge v-if="d.online && d.state !== 'idle'" variant="warning">加入排队</Badge>
            </div>
          </button>
        </div>
      </div>

      <!-- ② 打印参数 -->
      <div class="rounded-2xl border border-border bg-card shadow-soft p-6 mb-6">
        <h3 class="text-lg font-semibold flex items-center gap-2 mb-5">
          <SlidersHorizontal class="w-5 h-5 text-violet-600" /> ② 打印参数配置
        </h3>

        <!-- 填充密度 -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <Label>填充密度</Label>
            <span class="text-sm font-semibold text-primary">{{ Math.round(infillRate * 100) }}%</span>
          </div>
          <input
            type="range" min="5" max="100" step="5"
            :value="infillPercent" class="w-full accent-indigo-500"
            @input="infillPercent = Number(($event.target as HTMLInputElement).value)"
          />
          <div class="flex justify-between text-xs text-muted-foreground mt-1">
            <span>5%（节省耗材）</span>
            <span>100%（实心）</span>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            填充密度直接影响用料量与最终费用（默认 {{ Math.round(defaultInfill * 100) }}%）
          </p>
        </div>

        <!-- 支撑 -->
        <div class="mb-6">
          <Label class="mb-2">支撑数量</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SUPPORT_OPTIONS" :key="opt.value"
              @click="supports = opt.value"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                supports === opt.value ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
              ]"
            >
              {{ opt.label }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground mt-2">悬空结构较多时建议开启支撑，打印完成后需自行拆除</p>
        </div>

        <!-- 耗材颜色 -->
        <div>
          <Label class="mb-2">耗材颜色</Label>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="c in COLOR_OPTIONS" :key="c.name"
              @click="color = c.name"
              :title="c.name"
              :class="[
                'w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center',
                color === c.name ? 'border-primary scale-110 shadow-soft' : 'border-border hover:scale-105',
              ]"
            >
              <span class="w-7 h-7 rounded-full border border-black/10" :style="{ backgroundColor: c.hex }"></span>
            </button>
          </div>
          <p class="text-xs text-muted-foreground mt-2">当前选择：<span class="font-medium text-foreground">{{ color }}</span>（以现场实际库存为准）</p>
        </div>
      </div>

      <!-- ③ 确认下单 -->
      <div class="rounded-2xl border border-border bg-card shadow-soft p-6 mb-6">
        <h3 class="text-lg font-semibold flex items-center gap-2 mb-5">
          <ShoppingCart class="w-5 h-5 text-emerald-600" /> ③ 确认下单
        </h3>

        <div class="space-y-2 mb-5">
          <Label>订单备注（选填）</Label>
          <Textarea v-model="remark" placeholder="例如：交货时间要求、表面处理偏好等" rows="2" />
        </div>

        <div class="rounded-xl bg-secondary/40 p-4 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">打印设备</span>
            <span class="font-medium">{{ selectedDeviceName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">填充密度</span>
            <span class="font-medium">{{ Math.round(infillRate * 100) }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">支撑数量</span>
            <span class="font-medium">{{ supportLabel }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">耗材颜色</span>
            <span class="font-medium">{{ color }}</span>
          </div>
          <div class="flex justify-between pt-2 border-t border-border">
            <span class="text-muted-foreground">体积 × 填充 × 密度 × 单价</span>
            <span class="text-xs text-muted-foreground self-center">
              {{ scaledVolume }} × {{ Math.round(infillRate * 100) }}% × {{ material.density }} × ¥{{ material.pricePerGram }}/g
            </span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="rounded-2xl gradient-bg p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm text-white/80">本次订单费用</p>
          <p class="text-4xl font-bold mt-1">¥{{ estimatedCost }}</p>
          <p class="text-xs text-white/70 mt-1">当前余额 ¥{{ userStore.user?.balance ?? '0' }}</p>
        </div>
        <div class="flex gap-3">
          <Button variant="secondary" class="bg-white/15 text-white hover:bg-white/25 border-0" @click="$router.push('/upload')">
            <ArrowLeft class="w-4 h-4" /> 返回修改
          </Button>
          <Button
            variant="secondary" size="lg"
            class="bg-white text-primary hover:bg-white/90"
            :disabled="submitting || !deviceId || !userStore.user || userStore.user.balance < Number(estimatedCost)"
            @click="submitOrder"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ submitting ? '提交中...' : `确认下单（扣费 ¥${estimatedCost}）` }}
          </Button>
        </div>
      </div>
      <p v-if="userStore.user && userStore.user.balance < Number(estimatedCost)" class="text-sm text-red-500 mt-2 text-center">
        余额不足，请先前往 <router-link to="/balance" class="text-primary underline">余额充值</router-link> 页面充值
      </p>
    </template>

    <div v-else class="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-soft">
      <Package class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p class="font-medium">未找到模型信息</p>
      <Button variant="gradient" size="sm" class="mt-4" @click="$router.push('/upload')">去上传模型</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import { getMyModels, getPublicDevices, getMaterialConfig, createOrder } from '@/api'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import {
  Package, Printer, RefreshCw, SlidersHorizontal, ShoppingCart,
  Loader2, ArrowLeft,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const model = ref<any>(null)
const devices = ref<any[]>([])
const material = ref<any>({ density: 1.24, pricePerGram: 0.5, infillRate: 0.2 })

// 表单状态
const scale = ref(Number(route.query.scale) || 1)
const deviceId = ref('')
const infillPercent = ref(20)
const supports = ref(0)
const color = ref('白色')
const remark = ref('')
const submitting = ref(false)

const SUPPORT_OPTIONS = [
  { value: 0, label: '无支撑' },
  { value: 25, label: '轻度' },
  { value: 50, label: '标准' },
  { value: 100, label: '密集' },
]

const COLOR_OPTIONS = [
  { name: '白色', hex: '#f5f5f4' },
  { name: '黑色', hex: '#1c1917' },
  { name: '灰色', hex: '#9ca3af' },
  { name: '红色', hex: '#ef4444' },
  { name: '蓝色', hex: '#3b82f6' },
  { name: '绿色', hex: '#22c55e' },
  { name: '黄色', hex: '#eab308' },
  { name: '橙色', hex: '#f97316' },
  { name: '紫色', hex: '#a855f7' },
  { name: '透明', hex: '#dbeafe' },
]

let socket: Socket | null = null

onMounted(async () => {
  const modelId = Number(route.query.modelId)
  if (!modelId) {
    loading.value = false
    return
  }
  try {
    const [models, devs, mat] = await Promise.all([getMyModels(), getPublicDevices(), getMaterialConfig()])
    model.value = (models as any[]).find((m) => m.id === modelId) || null
    devices.value = (devs as any[]).filter((d) => d.category === 'fdm')
    material.value = mat
    infillPercent.value = Math.round((mat.infillRate || 0.2) * 100)
    // 默认选中空闲设备
    const idle = devices.value.find((d) => d.online && d.state === 'idle')
    deviceId.value = idle?.id || ''
    if (model.value) {
      // 打开过的模型可能属于旧上传，刷新用户余额展示
      if (userStore.token && !userStore.user) await userStore.fetchProfile()
    }
  } finally {
    loading.value = false
  }
  // WS 订阅设备实时状态（刷新可选性）
  socket = io('/devices', { auth: { token: localStorage.getItem('token') } })
  socket.on('device:public_status', (d: any) => {
    const i = devices.value.findIndex((x) => x.id === d.id)
    if (i >= 0) devices.value[i] = { ...devices.value[i], ...d }
  })
})

// 页面离开时断开 WS
onUnmounted(() => socket?.disconnect())

const defaultInfill = computed(() => material.value.infillRate || 0.2)
const infillRate = computed(() => infillPercent.value / 100)
const scaleCubed = computed(() => scale.value * scale.value * scale.value)
const scaledVolume = computed(() => {
  if (!model.value) return '0'
  return (+(model.value.volume * scaleCubed.value)).toFixed(2)
})
const estimatedCost = computed(() => {
  if (!model.value) return '0.00'
  const c = model.value.volume * scaleCubed.value * infillRate.value * material.value.density * material.value.pricePerGram
  return c.toFixed(2)
})

const selectedDeviceName = computed(() => {
  if (!deviceId.value) return '请选择设备'
  return devices.value.find((d) => d.id === deviceId.value)?.name || deviceId.value
})

const supportLabel = computed(() => SUPPORT_OPTIONS.find((o) => o.value === supports.value)?.label || '无支撑')

function stateLabel(s: string) {
  const m: Record<string, string> = {
    unknown: '未知', offline: '离线', idle: '空闲', working: '作业中',
    paused: '已暂停', error: '错误', maintenance: '维护中',
  }
  return m[s] || s
}

async function loadDevices() {
  const devs = await getPublicDevices()
  devices.value = (devs as any[]).filter((d) => d.category === 'fdm')
  if (deviceId.value && !devices.value.find((d) => d.id === deviceId.value)) deviceId.value = ''
}

async function submitOrder() {
  if (!deviceId.value) {
    toast.warning('请先选择打印设备')
    return
  }
  submitting.value = true
  try {
    const order = await createOrder(model.value.id, remark.value.trim() || undefined, scale.value, {
      deviceId: deviceId.value,
      infillRate: infillRate.value,
      supports: supports.value,
      color: color.value,
    })
    toast.success(`订单已提交，订单号：${order.order_no}`)
    userStore.setBalance(+(userStore.user!.balance - Number(order.cost)).toFixed(2))
    router.push('/orders')
  } finally {
    submitting.value = false
  }
}
</script>
