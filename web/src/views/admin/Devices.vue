<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">设备管理</h1>
        <p class="text-muted-foreground mt-1">实时监控所有打印机 / 激光设备，远程控制与连接诊断</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Tooltip content="测试全部已接入设备的连接连通性">
          <Button variant="outline" :disabled="testing" @click="testAll">
            <Loader2 v-if="testing" class="w-4 h-4 animate-spin" />
            <RadioTower v-else class="w-4 h-4" /> 测试全部连接
          </Button>
        </Tooltip>
        <Tooltip content="重新从数据库同步设备清单并全部重连">
          <Button variant="outline" :disabled="reloading" @click="reloadConfig">
            <Loader2 v-if="reloading" class="w-4 h-4 animate-spin" />
            <RefreshCw v-else class="w-4 h-4" /> 重载配置
          </Button>
        </Tooltip>
        <Tooltip content="可视化新增一台设备（选品牌型号自动带出参数）">
          <Button variant="gradient" @click="openAddForm">
            <Plus class="w-4 h-4" /> 新增设备
          </Button>
        </Tooltip>
      </div>
    </div>

    <!-- 汇总 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <div v-for="s in summaryCards" :key="s.label"
        class="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div class="flex items-center gap-3 mb-2">
          <div :class="['w-9 h-9 rounded-lg flex items-center justify-center', s.bg]">
            <component :is="s.icon" class="w-4.5 h-4.5" :class="s.color" />
          </div>
        </div>
        <div class="text-2xl font-bold tracking-tight">{{ s.value }}</div>
        <div class="text-xs text-muted-foreground mt-0.5">{{ s.label }}</div>
      </div>
    </div>

    <!-- 连接测试结果 -->
    <div v-if="testResults" class="rounded-2xl border border-border bg-card shadow-soft mb-6 overflow-hidden">
      <div class="flex items-center justify-between p-5 border-b border-border">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <RadioTower class="w-5 h-5 text-primary" /> 连接测试结果
        </h3>
        <button class="text-muted-foreground hover:text-foreground" @click="testResults = null">
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="divide-y divide-border">
        <div v-for="(r, id) in testResults" :key="id" class="flex items-start gap-3 px-5 py-3">
          <component :is="r.ok ? CheckCircle2 : XCircle" :class="['w-5 h-5 mt-0.5 shrink-0', r.ok ? 'text-emerald-500' : 'text-red-500']" />
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ deviceName(id as string) }}
              <span v-if="r.ok" class="text-xs text-muted-foreground font-normal">（{{ r.latencyMs }}ms）</span>
            </p>
            <p :class="['text-xs mt-0.5 break-all', r.ok ? 'text-muted-foreground' : 'text-red-600']">{{ r.message }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 设备网格 -->
    <ListSkeleton v-if="loading" :columns="4" :rows="3" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div v-for="d in devices" :key="d.id"
        class="rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all duration-300 overflow-hidden"
        :class="{ 'opacity-70': !d.enabled }">
        <!-- 卡片头 -->
        <div class="p-5 border-b border-border/60">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', categoryMeta(d).bg]">
                <component :is="categoryMeta(d).icon" class="w-5 h-5" :class="categoryMeta(d).color" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold truncate">{{ d.name }}</p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ categoryMeta(d).label }}<template v-if="d.model"> · {{ d.model }}</template>
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <Badge :variant="onlineBadge(d)">
                <span class="w-1.5 h-1.5 rounded-full mr-1"
                  :class="d.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'"></span>
                {{ d.online ? '在线' : '离线' }}
              </Badge>
              <Badge :variant="stateBadge(d.state)">{{ stateLabel(d.state) }}</Badge>
            </div>
          </div>

          <!-- 进度条 -->
          <div v-if="d.state === 'working' && d.progress != null" class="mt-4">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="text-muted-foreground">作业进度</span>
              <span class="font-semibold text-primary">
                {{ Math.round(d.progress) }}%
                <template v-if="d.remainingMinutes != null">（剩余 ~{{ d.remainingMinutes }} 分钟）</template>
              </span>
            </div>
            <div class="h-2 rounded-full bg-secondary overflow-hidden">
              <div class="h-full gradient-bg rounded-full transition-all duration-700" :style="{ width: Math.min(100, d.progress) + '%' }"></div>
            </div>
          </div>

          <p class="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5" />
            最后在线：{{ d.lastSeenAt || '从未' }}
          </p>
        </div>

        <!-- 操作区 -->
        <div class="p-4 space-y-3">
          <!-- 远程命令 -->
          <div v-if="d.supports && d.supports.length" class="flex flex-wrap gap-2">
            <Tooltip content="暂停当前作业（仅作业中可暂停）">
              <Button v-if="d.supports.includes('pause')" variant="outline" size="sm" :disabled="d.state !== 'working'" @click="command(d, 'pause')">
                <Pause class="w-3.5 h-3.5" /> 暂停
              </Button>
            </Tooltip>
            <Tooltip content="恢复已暂停的作业（仅暂停态可恢复）">
              <Button v-if="d.supports.includes('resume')" variant="outline" size="sm" :disabled="d.state !== 'paused'" @click="command(d, 'resume')">
                <Play class="w-3.5 h-3.5" /> 恢复
              </Button>
            </Tooltip>
            <Tooltip content="停止当前作业（作业中或暂停态可停止）">
              <Button v-if="d.supports.includes('stop')" variant="destructive" size="sm" :disabled="d.state !== 'working' && d.state !== 'paused'" @click="command(d, 'stop')">
                <Square class="w-3.5 h-3.5" /> 停止
              </Button>
            </Tooltip>
            <Tooltip :content="ledStateOf(d) ? '关闭设备灯光' : '开启设备灯光'">
              <Button v-if="d.supports.includes('led_on')" variant="outline" size="sm" @click="toggleLed(d)">
                <component :is="ledStateOf(d) ? Lightbulb : LightbulbOff" class="w-3.5 h-3.5" />
                {{ ledStateOf(d) ? '灯光开' : '灯光关' }}
              </Button>
            </Tooltip>
          </div>

          <div class="flex flex-wrap gap-2">
            <Tooltip content="测试该设备连接连通性">
              <Button variant="outline" size="sm" @click="testOne(d)">
                <Loader2 v-if="testingId === d.id" class="w-3.5 h-3.5 animate-spin" />
                <PlugZap v-else class="w-3.5 h-3.5" /> 测试
              </Button>
            </Tooltip>
            <Tooltip content="查看该设备的事件与连接日志">
              <Button variant="outline" size="sm" @click="showEvents(d)">
                <ScrollText class="w-3.5 h-3.5" /> 事件
              </Button>
            </Tooltip>
            <Tooltip :content="d.enabled ? '停用设备进入维护状态' : '启用设备恢复使用'">
              <Button :variant="d.enabled ? 'destructive' : 'default'" size="sm" @click="toggle(d)">
                <component :is="d.enabled ? Wrench : CheckCircle2" class="w-3.5 h-3.5" />
                {{ d.enabled ? '停用维护' : '启用' }}
              </Button>
            </Tooltip>
            <Tooltip content="删除该设备（从系统移除）">
              <Button variant="outline" size="sm" class="text-red-500 border-red-200 hover:bg-red-50" @click="removeDevice(d)">
                <Trash2 class="w-3.5 h-3.5" /> 删除
              </Button>
            </Tooltip>
          </div>

          <!-- E1 手动状态 -->
          <div v-if="d.type === 'eufymake'" class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span class="text-xs text-muted-foreground">手动状态：</span>
            <button
              v-for="st in ['idle', 'working', 'error']" :key="st"
              @click="setManual(d, st)"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                manualStateOf(d) === st ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
              ]"
            >
              {{ stateLabel(st) }}
            </button>
            <button
              v-if="manualStateOf(d)"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/70 transition-colors"
              @click="setManual(d, null)"
            >
              清除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时事件流 -->
    <div class="mt-6 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex items-center justify-between p-5 border-b border-border">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <Bell class="w-5 h-5 text-primary" /> 实时事件
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </h3>
        <Button variant="ghost" size="sm" @click="liveEvents = []">
          <Trash2 class="w-4 h-4" /> 清空
        </Button>
      </div>
      <div v-if="!liveEvents.length" class="py-10 text-center text-sm text-muted-foreground">
        暂无事件，设备状态变化与操作将实时推送至此
      </div>
      <div v-else class="max-h-80 overflow-y-auto divide-y divide-border">
        <div v-for="(e, i) in liveEvents" :key="i" class="flex items-start gap-3 px-5 py-2.5">
          <span :class="['w-2 h-2 rounded-full mt-1.5 shrink-0',
            e.level === 'error' ? 'bg-red-500' : e.level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500']"></span>
          <div class="min-w-0 flex-1">
            <p class="text-sm">{{ e.message }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ deviceName(e.deviceId) }} · {{ formatTime(e.at) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 事件日志弹窗 -->
    <Dialog v-model="eventVisible">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">设备事件日志</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="eventVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <p class="text-sm text-muted-foreground">{{ eventDevice?.name }}（最近 {{ eventLogs.length }} 条）</p>
        <div class="max-h-96 overflow-y-auto space-y-2">
          <div v-for="log in eventLogs" :key="log.id"
            class="rounded-lg border border-border bg-secondary/30 p-3">
            <div class="flex items-center gap-2 mb-1">
              <Badge :variant="log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'warning' : 'secondary'">
                {{ log.event_type }}
              </Badge>
              <span class="text-xs text-muted-foreground">{{ log.created_at }}</span>
            </div>
            <p class="text-sm">{{ log.message }}</p>
          </div>
          <p v-if="!eventLogs.length" class="text-center text-sm text-muted-foreground py-6">暂无日志</p>
        </div>
      </div>
    </Dialog>

    <!-- 新增设备 -->
    <DeviceForm ref="formRef" @saved="loadDevices" />
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted, onUnmounted, computed, markRaw } from 'vue'
import { io, Socket } from 'socket.io-client'
import {
  listDevices, testAllDevices, testDevice, sendDeviceCommand, toggleDevice,
  setDeviceManualState, getDeviceEvents, reloadDeviceConfig, removeDevice as apiRemoveDevice,
} from '@/api'
import { toast } from '@/composables/useToast'
import {
  RadioTower, RefreshCw, Loader2, X, CheckCircle2, XCircle, Clock, Pause, Play, Square,
  Lightbulb, LightbulbOff, PlugZap, ScrollText, Wrench, Bell, Trash2, Plus,
  Printer, Flame, Layers,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'
import DeviceForm from './DeviceForm.vue'

interface AdminDevice {
  id: string; name: string; type: string; category: string; model?: string
  enabled: boolean; online: boolean; state: string
  progress?: number; remainingMinutes?: number
  detail?: Record<string, unknown>; lastSeenAt: string | null
  supports: string[]
}

interface ConnectionResult { ok: boolean; message: string; latencyMs?: number }

interface LiveEvent {
  deviceId: string | null; level: string; eventType: string; message: string; at: string
}

const devices = ref<AdminDevice[]>([])
const loading = ref(false)
const testing = ref(false)
const reloading = ref(false)
const testingId = ref('')
const testResults = ref<Record<string, ConnectionResult> | null>(null)
const liveEvents = ref<LiveEvent[]>([])

// 事件日志弹窗
const eventVisible = ref(false)
const eventDevice = ref<AdminDevice | null>(null)
const eventLogs = ref<any[]>([])

let socket: Socket | null = null

onMounted(async () => {
  await loadDevices()
  // WS 实时状态 + 事件流
  socket = io('/devices', { auth: { token: localStorage.getItem('token') } })
  socket.on('device:status', (d: AdminDevice) => {
    const i = devices.value.findIndex((x) => x.id === d.id)
    if (i >= 0) devices.value[i] = d
    else devices.value.push(d)
  })
  socket.on('device:event', (e: LiveEvent) => {
    liveEvents.value.unshift({ ...e, at: e.at || new Date().toISOString() })
    if (liveEvents.value.length > 100) liveEvents.value.pop()
  })
})

onUnmounted(() => socket?.disconnect())

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await listDevices()
  } finally {
    loading.value = false
  }
}

function deviceName(id: string) {
  return devices.value.find((d) => d.id === id)?.name || id
}

async function testAll() {
  testing.value = true
  try {
    const r = await testAllDevices()
    testResults.value = r
    const fails = Object.values(r).filter((x) => !x.ok).length
    const total = Object.keys(r).length
    if (fails === 0) toast.success(`全部 ${total} 台设备连接成功`)
    else toast.warning(`${total - fails} 台成功，${fails} 台失败，详见下方结果`)
    await loadDevices()
  } finally {
    testing.value = false
  }
}

async function testOne(d: AdminDevice) {
  testingId.value = d.id
  try {
    const r = await testDevice(d.id)
    if (r.ok) toast.success(`${d.name} 连接成功（${r.latencyMs}ms）`)
    else toast.error(`${d.name} 连接失败：${r.message}`)
    await loadDevices()
  } finally {
    testingId.value = ''
  }
}

async function reloadConfig() {
  reloading.value = true
  try {
    const r = await reloadDeviceConfig()
    const fails = Object.values(r).filter((x) => !x.ok).length
    toast.success(`配置已重载，${Object.keys(r).length - fails} 台在线${fails ? `，${fails} 台失败` : ''}`)
    await loadDevices()
  } finally {
    reloading.value = false
  }
}

async function command(d: AdminDevice, cmd: string) {
  await sendDeviceCommand(d.id, cmd)
  toast.success(`${d.name} 已发送命令：${cmdLabel(cmd)}`)
}

async function toggle(d: AdminDevice) {
  const r = await toggleDevice(d.id)
  toast.success(r.enabled ? `${d.name} 已启用` : `${d.name} 已停用（维护）`)
  await loadDevices()
}

/** E1 手动状态（detail.manualState 由适配器上报） */
function manualStateOf(d: AdminDevice): string | null {
  return (d.detail?.manualState as string) || null
}

async function setManual(d: AdminDevice, state: string | null) {
  await setDeviceManualState(d.id, state)
  toast.success(`${d.name} 手动状态：${state ? stateLabel(state) : '清除（恢复自动）'}`)
  await loadDevices()
}

async function showEvents(d: AdminDevice) {
  eventDevice.value = d
  eventLogs.value = await getDeviceEvents(d.id, 100)
  eventVisible.value = true
}

// ===== 新增/删除设备 =====
const formRef = ref<InstanceType<typeof DeviceForm> | null>(null)

function openAddForm() {
  formRef.value?.open()
}

async function removeDevice(d: AdminDevice) {
  if (!confirm(`确认删除设备「${d.name}」？该操作将从系统永久移除。`)) return
  try {
    await apiRemoveDevice(d.id)
    toast.success(`${d.name} 已删除`)
    await loadDevices()
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || '删除失败')
  }
}

// ===== 灯光切换 =====
function ledStateOf(d: AdminDevice): boolean {
  // 从遥测 detail 记录灯光状态（由适配器上报），默认关闭
  return !!((d.detail as any)?.ledOn)
}

async function toggleLed(d: AdminDevice) {
  const on = ledStateOf(d)
  try {
    await sendDeviceCommand(d.id, on ? 'led_off' : 'led_on')
    toast.success(`${d.name} 灯光已${on ? '关闭' : '开启'}`)
    await loadDevices()
  } catch (e: any) {
    toast.error(e?.response?.data?.msg || '灯光控制失败')
  }
}

// ===== 展示映射 =====
const CATEGORY_META: Record<string, { label: string; icon: any; bg: string; color: string }> = {
  fdm: { label: '3D 打印机', icon: markRaw(Printer), bg: 'bg-sky-100', color: 'text-sky-600' },
  laser: { label: '激光设备', icon: markRaw(Flame), bg: 'bg-rose-100', color: 'text-rose-600' },
  uv: { label: 'UV 打印机', icon: markRaw(Layers), bg: 'bg-violet-100', color: 'text-violet-600' },
}
function categoryMeta(d: AdminDevice) {
  return CATEGORY_META[d.category] || { label: d.category, icon: markRaw(Layers), bg: 'bg-slate-100', color: 'text-slate-600' }
}

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

function onlineBadge(d: AdminDevice) {
  if (!d.enabled) return 'warning'
  return d.online ? 'success' : 'secondary'
}

function cmdLabel(c: string) {
  const m: Record<string, string> = {
    pause: '暂停', resume: '恢复', stop: '停止',
    led_on: '开灯', led_off: '关灯', pushall: '刷新状态',
  }
  return m[c] || c
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

const summaryCards = computed(() => [
  { label: '设备总数', value: devices.value.length, icon: markRaw(Layers), bg: 'bg-sky-100', color: 'text-sky-600' },
  { label: '在线', value: devices.value.filter((d) => d.online).length, icon: markRaw(RadioTower), bg: 'bg-emerald-100', color: 'text-emerald-600' },
  { label: '作业中', value: devices.value.filter((d) => d.state === 'working').length, icon: markRaw(Printer), bg: 'bg-indigo-100', color: 'text-indigo-600' },
  { label: '维护/异常', value: devices.value.filter((d) => !d.enabled || d.state === 'error').length, icon: markRaw(Wrench), bg: 'bg-amber-100', color: 'text-amber-600' },
])
</script>
