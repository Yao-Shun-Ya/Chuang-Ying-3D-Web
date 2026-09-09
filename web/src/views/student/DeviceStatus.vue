<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">设备状态</h1>
        <p class="text-muted-foreground mt-1">
          实时监控全部打印与激光设备
          <span class="inline-flex items-center gap-1 ml-1 text-emerald-600">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 实时
          </span>
        </p>
      </div>
      <Button variant="outline" @click="loadDevices">
        <RefreshCw class="w-4 h-4" /> 刷新
      </Button>
    </div>

    <!-- 分类汇总 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <div v-for="c in summaryCards" :key="c.label"
        class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center gap-3 mb-2">
          <div :class="['w-9 h-9 rounded-lg flex items-center justify-center', c.bg]">
            <component :is="c.icon" class="w-4.5 h-4.5" :class="c.color" />
          </div>
        </div>
        <div class="text-2xl font-bold tracking-tight">{{ c.value }}</div>
        <div class="text-xs text-muted-foreground mt-0.5">{{ c.label }}</div>
      </div>
    </div>

    <!-- 设备分组 -->
    <div v-for="group in deviceGroups" :key="group.key" class="mb-8">
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <component :is="group.icon" :class="['w-5 h-5', group.color]" />
        {{ group.title }}
        <span class="text-sm text-muted-foreground font-normal">（{{ group.devices.length }} 台）</span>
      </h3>
      <ListSkeleton v-if="loading" :columns="4" :rows="2" />
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="d in group.devices" :key="d.id"
          class="rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all duration-300 p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', group.bg]">
                <component :is="group.icon" class="w-5 h-5" :class="group.color" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold truncate">{{ d.name }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ d.model || group.title }}</p>
              </div>
            </div>
            <Badge :variant="d.online ? 'success' : 'secondary'">
              <span class="w-1.5 h-1.5 rounded-full mr-1" :class="d.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'"></span>
              {{ d.online ? '在线' : '离线' }}
            </Badge>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">当前状态</span>
            <Badge :variant="stateBadge(d.state)">{{ stateLabel(d.state) }}</Badge>
          </div>

          <!-- 打印进度 -->
          <template v-if="d.state === 'working' && d.progress != null">
            <div class="mt-3">
              <div class="flex items-center justify-between text-xs mb-1.5">
                <span class="text-muted-foreground">进度</span>
                <span class="font-semibold text-primary">
                  {{ Math.round(d.progress) }}%
                  <template v-if="d.remainingMinutes != null">（剩余 ~{{ d.remainingMinutes }} 分钟）</template>
                </span>
              </div>
              <div class="h-2 rounded-full bg-secondary overflow-hidden">
                <div class="h-full gradient-bg rounded-full transition-all duration-700"
                  :style="{ width: Math.min(100, d.progress) + '%' }"></div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="!loading && !devices.length" class="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-soft">
      <MonitorOff class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p>暂无设备信息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted, onUnmounted, computed, markRaw } from 'vue'
import { io, Socket } from 'socket.io-client'
import { getPublicDevices } from '@/api'
import { RefreshCw, Printer, Flame, Layers, MonitorOff } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'

interface PublicDevice {
  id: string; name: string; type: string; category: string; model?: string
  state: string; online: boolean; progress?: number; remainingMinutes?: number
}

const devices = ref<PublicDevice[]>([])
const loading = ref(false)
let socket: Socket | null = null

onMounted(async () => {
  await loadDevices()
  socket = io('/devices', { auth: { token: localStorage.getItem('token') } })
  socket.on('device:public_status', (d: PublicDevice) => {
    const i = devices.value.findIndex((x) => x.id === d.id)
    if (i >= 0) devices.value[i] = { ...devices.value[i], ...d }
    else devices.value.push(d)
  })
})

onUnmounted(() => socket?.disconnect())

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await getPublicDevices()
  } finally {
    loading.value = false
  }
}

const deviceGroups = computed(() => [
  {
    key: 'fdm', title: '3D 打印机', icon: markRaw(Printer),
    color: 'text-sky-600', bg: 'bg-sky-100',
    devices: devices.value.filter((d) => d.category === 'fdm'),
  },
  {
    key: 'laser', title: '激光设备', icon: markRaw(Flame),
    color: 'text-rose-600', bg: 'bg-rose-100',
    devices: devices.value.filter((d) => d.category === 'laser'),
  },
  {
    key: 'uv', title: 'UV 打印机', icon: markRaw(Layers),
    color: 'text-violet-600', bg: 'bg-violet-100',
    devices: devices.value.filter((d) => d.category === 'uv'),
  },
].filter((g) => g.devices.length || !loading.value))

const summaryCards = computed(() => [
  { label: '在线设备', value: devices.value.filter((d) => d.online).length, icon: markRaw(Printer), bg: 'bg-emerald-100', color: 'text-emerald-600' },
  { label: '空闲打印机', value: devices.value.filter((d) => d.category === 'fdm' && d.state === 'idle').length, icon: markRaw(Printer), bg: 'bg-sky-100', color: 'text-sky-600' },
  { label: '作业中', value: devices.value.filter((d) => d.state === 'working').length, icon: markRaw(Layers), bg: 'bg-indigo-100', color: 'text-indigo-600' },
  { label: '离线 / 维护', value: devices.value.filter((d) => !d.online || d.state === 'maintenance').length, icon: markRaw(MonitorOff), bg: 'bg-amber-100', color: 'text-amber-600' },
])

const STATE_MAP: Record<string, { label: string; badge: any }> = {
  unknown: { label: '未知', badge: 'secondary' },
  offline: { label: '离线', badge: 'outline' },
  idle: { label: '空闲', badge: 'success' },
  working: { label: '作业中', badge: 'info' },
  paused: { label: '已暂停', badge: 'warning' },
  error: { label: '错误', badge: 'destructive' },
  maintenance: { label: '维护中', badge: 'warning' },
}
function stateLabel(s: string) { return STATE_MAP[s]?.label || s }
function stateBadge(s: string) { return STATE_MAP[s]?.badge || 'secondary' }
</script>
