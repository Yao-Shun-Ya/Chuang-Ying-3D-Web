<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">管理后台</h1>
      <p class="text-muted-foreground mt-1">平台运营数据总览</p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
      <div
        v-for="(s, i) in stats"
        :key="s.label"
        class="group rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300"
      >
        <div class="flex items-center justify-between mb-4">
          <div :class="['w-11 h-11 rounded-xl flex items-center justify-center', s.bg]">
            <component :is="s.icon" class="w-5 h-5" :class="s.color" />
          </div>
        </div>
        <div class="text-3xl font-bold tracking-tight">{{ s.value }}</div>
        <div class="text-sm text-muted-foreground mt-1">{{ s.label }}</div>
      </div>
    </div>

    <!-- Quick links + pending -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div class="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap class="w-5 h-5 text-primary" /> 快捷入口
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <router-link
            v-for="link in links"
            :key="link.path"
            :to="link.path"
            class="group flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div :class="['w-9 h-9 rounded-lg flex items-center justify-center', link.bg]">
              <component :is="link.icon" class="w-4 h-4" :class="link.color" />
            </div>
            <div>
              <p class="text-sm font-medium">{{ link.label }}</p>
              <p class="text-xs text-muted-foreground">{{ link.desc }}</p>
            </div>
          </router-link>
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock class="w-5 h-5 text-amber-500" /> 待审核订单
        </h3>
        <div v-if="!pendingOrders.length" class="py-8 text-center text-muted-foreground">
          <CheckCircle2 class="w-10 h-10 mx-auto mb-2 text-emerald-500/60" />
          <p class="text-sm">暂无待审核订单</p>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="o in pendingOrders.slice(0, 5)"
            :key="o.id"
            class="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/40 cursor-pointer transition-colors"
            @click="$router.push('/admin/orders')"
          >
            <div>
              <p class="font-mono text-xs text-muted-foreground">{{ o.order_no }}</p>
              <p class="text-sm font-medium">{{ o.model_name }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-primary">¥{{ o.cost }}</p>
              <p class="text-xs text-muted-foreground">{{ o.username }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系统健康监控 -->
    <div class="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Activity class="w-5 h-5 text-emerald-600" />
          </div>
          <h3 class="text-lg font-semibold">系统健康</h3>
        </div>
        <button
          class="text-muted-foreground hover:text-foreground transition-colors"
          :disabled="healthLoading"
          @click="loadHealth"
          title="刷新"
        >
          <Loader2 v-if="healthLoading" class="w-4 h-4 animate-spin" />
          <RefreshCw v-else class="w-4 h-4" />
        </button>
      </div>

      <div v-if="healthError" class="py-6 text-center text-sm text-red-500">
        {{ healthError }}
      </div>
      <div v-else-if="!health" class="py-6 text-center text-muted-foreground text-sm">
        <Loader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
        加载中...
      </div>
      <template v-else>
        <!-- 状态徽标 -->
        <div class="flex items-center gap-2 mb-5">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            :class="health.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
            <span class="w-1.5 h-1.5 rounded-full animate-pulse"
              :class="health.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'"></span>
            {{ health.status === 'ok' ? '运行正常' : '异常' }}
          </span>
          <span class="text-xs text-muted-foreground">已运行 {{ formatUptime(health.uptime) }}</span>
          <span class="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Database class="w-3.5 h-3.5" :class="health.database?.connected ? 'text-emerald-500' : 'text-red-500'" />
            数据库{{ health.database?.connected ? '正常' : '断开' }}
          </span>
        </div>

        <!-- 磁盘 / 内存 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div v-for="m in healthMeters" :key="m.label">
            <div class="flex items-center justify-between text-sm mb-1.5">
              <span class="font-medium flex items-center gap-1.5">
                <component :is="m.icon" class="w-4 h-4 text-muted-foreground" />
                {{ m.label }}
              </span>
              <span :class="['font-semibold', m.color]">{{ m.usagePercent }}%</span>
            </div>
            <div class="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :class="m.barColor"
                :style="{ width: m.usagePercent + '%' }"
              ></div>
            </div>
            <p class="text-xs text-muted-foreground mt-1.5">{{ m.detail }}</p>
          </div>
        </div>
      </template>
    </div>

    <!-- 管理员安全：Key 文件改密 -->
    <div class="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div class="flex items-center gap-2 mb-5">
        <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <KeyRound class="w-5 h-5 text-primary" />
        </div>
        <h3 class="text-lg font-semibold">管理员安全 · 修改密码</h3>
      </div>
      <p class="text-sm text-muted-foreground mb-4">
        拖入管理员 Key 文件以验证身份，验证通过后方可修改密码。Key 文件由服务端脚本生成，具有时效性。
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Key 文件拖入区 -->
        <div
          class="relative rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
          :class="{ 'border-primary bg-primary/5': dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <input ref="fileInput" type="file" accept=".key,.json" class="hidden" @change="onFilePick" />
          <UploadCloud v-if="!keyFile" class="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <FileCheck v-else class="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p class="text-sm font-medium" v-if="!keyFile">拖入 Key 文件，或点击选择</p>
          <p class="text-sm font-medium text-emerald-600" v-else>{{ keyFile.name }}</p>
          <p class="text-xs text-muted-foreground mt-1">支持 .key / .json 格式</p>
        </div>

        <!-- 新密码 -->
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>新密码</Label>
            <Input v-model="newPw" type="password" placeholder="至少 6 位" />
          </div>
          <div class="space-y-2">
            <Label>确认新密码</Label>
            <Input v-model="confirmPw" type="password" placeholder="再次输入新密码" />
          </div>
          <Button variant="gradient" class="w-full" :disabled="!keyContent || changing" @click="submitChangePw">
            <Loader2 v-if="changing" class="w-4 h-4 animate-spin mr-1.5" />
            {{ changing ? '提交中...' : '验证 Key 并修改密码' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted, computed, markRaw } from 'vue'
import { listAllOrders, listUsers, listAllTransactions, listCdk, changeAdminPasswordByKey } from '@/api'
import { Users, FileText, Clock, Wallet, Zap, ListChecks, Ticket, Receipt, KeyRound, UploadCloud, FileCheck, Loader2, Activity, RefreshCw, HardDrive, MemoryStick, Database, Flame, MonitorCog } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Button from '@/components/ui/Button.vue'

const orders = ref<any[]>([])
const users = ref<any[]>([])
const txs = ref<any[]>([])
const cdks = ref<any[]>([])

onMounted(async () => {
  orders.value = await listAllOrders()
  users.value = await listUsers()
  txs.value = await listAllTransactions()
  cdks.value = await listCdk()
  loadHealth()
})

// ===== 系统健康监控 =====
interface HealthData {
  status: string
  uptime: number
  database: { connected: boolean }
  disk: { freeGB: number; totalGB: number; usagePercent: number }
  memory: { freeMB: number; totalMB: number; usagePercent: number }
}
const health = ref<HealthData | null>(null)
const healthLoading = ref(false)
const healthError = ref('')

async function loadHealth() {
  healthLoading.value = true
  healthError.value = ''
  try {
    // /health 为公开端点，不走 axios 拦截器（避免统一弹错/401 跳转）
    const res = await fetch('/health')
    const body = await res.json()
    if (body.code !== 0) throw new Error()
    health.value = body.data
  } catch {
    healthError.value = '健康数据获取失败，后端服务可能未启动'
  } finally {
    healthLoading.value = false
  }
}

/** 用量分档：<70% 正常（绿）、70~90% 警告（琥珀）、>90% 危险（红） */
function usageLevel(p: number) {
  if (p > 90) return { color: 'text-red-600', barColor: 'bg-red-500' }
  if (p > 70) return { color: 'text-amber-600', barColor: 'bg-amber-500' }
  return { color: 'text-emerald-600', barColor: 'bg-emerald-500' }
}

const healthMeters = computed(() => {
  if (!health.value) return []
  const d = health.value.disk
  const m = health.value.memory
  return [
    {
      label: '磁盘使用',
      icon: markRaw(HardDrive),
      usagePercent: d.usagePercent,
      detail: `剩余 ${d.freeGB} GB / 共 ${d.totalGB} GB`,
      ...usageLevel(d.usagePercent),
    },
    {
      label: '内存使用',
      icon: markRaw(MemoryStick),
      usagePercent: m.usagePercent,
      detail: `剩余 ${(m.freeMB / 1024).toFixed(1)} GB / 共 ${(m.totalMB / 1024).toFixed(1)} GB`,
      ...usageLevel(m.usagePercent),
    },
  ]
})

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const min = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${min} 分钟`
  return `${min} 分钟`
}

const pendingOrders = computed(() => orders.value.filter((o) => o.status === 'pending_review'))
const totalRecharge = computed(() =>
  txs.value.filter((t) => t.type === 'recharge').reduce((s, t) => s + t.amount, 0),
)

const stats = computed(() => [
  { label: '用户总数', value: users.value.length, icon: markRaw(Users), bg: 'bg-sky-100', color: 'text-sky-600' },
  { label: '订单总数', value: orders.value.length, icon: markRaw(FileText), bg: 'bg-emerald-100', color: 'text-emerald-600' },
  { label: '待审核', value: pendingOrders.value.length, icon: markRaw(Clock), bg: 'bg-amber-100', color: 'text-amber-600' },
  { label: '累计充值(元)', value: totalRecharge.value.toFixed(2), icon: markRaw(Wallet), bg: 'bg-violet-100', color: 'text-violet-600' },
])

const links = [
  { path: '/admin/orders', label: '订单审核', desc: '审核与流转', icon: markRaw(ListChecks), bg: 'bg-indigo-100', color: 'text-indigo-600' },
  { path: '/admin/laser', label: '激光工坊', desc: '预约审核', icon: markRaw(Flame), bg: 'bg-rose-100', color: 'text-rose-600' },
  { path: '/admin/devices', label: '设备管理', desc: '监控与控制', icon: markRaw(MonitorCog), bg: 'bg-cyan-100', color: 'text-cyan-600' },
  { path: '/admin/cdk', label: 'CDK 管理', desc: '生成兑换码', icon: markRaw(Ticket), bg: 'bg-pink-100', color: 'text-pink-600' },
  { path: '/admin/transactions', label: '流水对账', desc: '导出明细', icon: markRaw(Receipt), bg: 'bg-teal-100', color: 'text-teal-600' },
  { path: '/admin/users', label: '用户管理', desc: '查看用户', icon: markRaw(Users), bg: 'bg-orange-100', color: 'text-orange-600' },
]

// ===== 管理员 Key 文件改密 =====
const fileInput = ref<HTMLInputElement>()
const keyFile = ref<File | null>(null)
const keyContent = ref('')
const dragOver = ref(false)
const newPw = ref('')
const confirmPw = ref('')
const changing = ref(false)

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

async function handleFile(file: File) {
  if (!file.name.match(/\.(key|json)$/i)) {
    toast.warning('请选择 .key 或 .json 文件')
    return
  }
  keyFile.value = file
  keyContent.value = await file.text()
}

async function submitChangePw() {
  if (!keyContent.value) return toast.warning('请拖入 Key 文件')
  if (newPw.value.length < 6) return toast.warning('新密码至少 6 位')
  if (newPw.value !== confirmPw.value) return toast.warning('两次新密码不一致')
  changing.value = true
  try {
    await changeAdminPasswordByKey(keyContent.value, newPw.value)
    toast.success('密码修改成功')
    keyFile.value = null
    keyContent.value = ''
    newPw.value = ''
    confirmPw.value = ''
    if (fileInput.value) fileInput.value.value = ''
  } finally {
    changing.value = false
  }
}
</script>
