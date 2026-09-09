<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">激光工坊</h1>
      <p class="text-muted-foreground mt-1">预约 → 管理员审核 → 到场核销使用 → 按实际分钟结算</p>
    </div>

    <!-- 使用中横幅 -->
    <div v-if="activeSession" class="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-6 shadow-soft">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative w-12 h-12 rounded-xl gradient-bg flex items-center justify-center">
            <Loader2 class="w-6 h-6 text-white animate-spin" />
          </div>
          <div>
            <p class="font-semibold">正在使用：{{ activeSession.device_name }}（预约 #{{ activeSession.id }}）</p>
            <p class="text-sm text-muted-foreground">
              开始于 {{ activeSession.started_at }}，计费 ¥{{ activeSession.price_per_minute }}/分钟
            </p>
          </div>
        </div>
        <Button variant="destructive" @click="endSession(activeSession)">
          <Square class="w-4 h-4" /> 结束使用并结算
        </Button>
      </div>
    </div>

    <!-- 核销区（有已批准预约时显示） -->
    <div v-for="s in approvedSessions" :key="s.id"
      class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 mb-6 shadow-soft">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="success">已批准 · 待核销</Badge>
            <span class="text-sm text-muted-foreground">{{ s.device_name }} · {{ s.planned_minutes }} 分钟</span>
          </div>
          <p class="text-sm text-muted-foreground">核销码已发送至邮箱，失效时间：{{ s.expires_at }}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-center px-4 py-2 rounded-xl bg-white border border-emerald-200">
            <p class="text-xs text-muted-foreground mb-0.5">核销码</p>
            <p class="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{{ s.verify_code }}</p>
          </div>
          <Button variant="gradient" @click="startByDevice(s)">
            <QrCode class="w-4 h-4" /> 我已到场，开始使用
          </Button>
          <Button variant="ghost" size="sm" @click="cancelSession(s)">取消</Button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 设备预约 -->
      <div class="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div class="p-6 border-b border-border">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <Flame class="w-5 h-5 text-rose-500" /> 可预约设备
          </h3>
          <p class="text-sm text-muted-foreground mt-1">实时状态更新，仅空闲且在线的设备可预约</p>
        </div>
        <ListSkeleton v-if="loading" :columns="2" :rows="3" />
        <div v-else-if="!devices.length" class="p-12 text-center text-muted-foreground">
          <Flame class="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>暂无可预约设备</p>
        </div>
        <div v-else class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div v-for="d in devices" :key="d.id"
            class="rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-soft transition-all"
            :class="{ 'opacity-60': !d.bookable }">
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                  <Flame class="w-4.5 h-4.5 text-rose-600" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium truncate">{{ d.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ d.model || categoryLabel(d.category) }}</p>
                </div>
              </div>
              <Badge :variant="d.online ? 'success' : 'secondary'">
                <span class="w-1.5 h-1.5 rounded-full mr-1" :class="d.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'"></span>
                {{ d.online ? '在线' : '离线' }}
              </Badge>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">费率</span>
              <span class="font-semibold text-primary">¥{{ d.pricePerMinute }}/分钟</span>
            </div>
            <div class="flex items-center justify-between text-sm mt-1">
              <span class="text-muted-foreground">状态</span>
              <span>{{ stateLabel(d.state) }}</span>
            </div>
            <Button variant="gradient" size="sm" class="w-full mt-3" :disabled="!d.bookable" @click="openBook(d)">
              {{ d.bookable ? '预约' : bookableHint(d) }}
            </Button>
          </div>
        </div>
      </div>

      <!-- 流程说明 -->
      <div class="rounded-2xl border border-border bg-card shadow-soft p-6 h-fit">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info class="w-5 h-5 text-primary" /> 使用流程
        </h3>
        <div class="space-y-4">
          <div v-for="(step, i) in steps" :key="i" class="flex gap-3">
            <div class="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
              {{ i + 1 }}
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed">{{ step }}</p>
          </div>
        </div>
        <div class="mt-5 pt-4 border-t border-border text-xs text-muted-foreground space-y-1.5">
          <p>· 按实际使用分钟数计费，结束使用后自动结算</p>
          <p>· 余额不足会产生欠费记录，请及时充值</p>
          <p>· 审核通过后需在有效期内到场核销，超时失效</p>
        </div>
      </div>
    </div>

    <!-- 我的预约 -->
    <div class="mt-6 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="p-6 border-b border-border flex items-center justify-between">
        <h3 class="text-lg font-semibold">我的预约记录</h3>
        <Button variant="ghost" size="sm" @click="loadMine">
          <RefreshCw class="w-4 h-4" /> 刷新
        </Button>
      </div>
      <div v-if="!mine.length" class="p-12 text-center text-muted-foreground">
        <CalendarClock class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>暂无预约记录</p>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>设备</TableHead>
            <TableHead>计划时长</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead>费用</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="s in mine" :key="s.id">
            <TableCell class="font-mono text-xs">#{{ s.id }}</TableCell>
            <TableCell>{{ s.device_name }}</TableCell>
            <TableCell>{{ s.planned_minutes }} 分钟</TableCell>
            <TableCell>
              <Badge :variant="statusBadge(s.status)">{{ statusLabel(s.status) }}</Badge>
              <Badge v-if="s.underpaid" variant="destructive" class="ml-1">欠费</Badge>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ s.started_at || s.created_at }}
            </TableCell>
            <TableCell>
              <template v-if="s.status === 'completed'">
                {{ s.actual_minutes }} 分钟 · ¥{{ s.fee }}
              </template>
              <span v-else class="text-muted-foreground">-</span>
            </TableCell>
            <TableCell>
              <div class="flex gap-1.5">
                <Button v-if="['pending_review', 'approved'].includes(s.status)" variant="ghost" size="sm" @click="cancelSession(s)">
                  取消
                </Button>
                <Button v-if="s.status === 'in_use'" variant="destructive" size="sm" @click="endSession(s)">
                  结束
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- 预约弹窗 -->
    <Dialog v-model="bookVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">预约 {{ bookDevice?.name }}</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="bookVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-2">
          <Label>计划时长</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="m in [30, 60, 90, 120, 180]" :key="m"
              @click="bookMinutes = m"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                bookMinutes === m ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
              ]"
            >
              {{ m }} 分钟
            </button>
          </div>
        </div>
        <div class="rounded-xl bg-secondary/50 p-3 text-sm">
          预计费用：<span class="font-semibold text-primary">¥{{ estimatedCost }}</span>
          <span class="text-muted-foreground">（¥{{ bookDevice?.pricePerMinute }}/分钟 × {{ bookMinutes }} 分钟，实际按使用分钟结算）</span>
        </div>
        <div class="space-y-2">
          <Label>用途说明（选填）</Label>
          <Textarea v-model="bookPurpose" placeholder="例如：亚克力板切割课程作业" rows="3" />
        </div>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="bookVisible = false">取消</Button>
          <Button variant="gradient" :disabled="booking" @click="confirmBook">
            <Loader2 v-if="booking" class="w-4 h-4 animate-spin" />
            {{ booking ? '提交中...' : '提交预约' }}
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- 核销码输入弹窗（备用：扫码不可用时） -->
    <Dialog v-model="codeVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">输入核销码</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="codeVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-2">
          <Label>核销码（审核通过邮件中的 6 位数字）</Label>
          <Input v-model="codeInput" placeholder="6 位数字" class="text-center font-mono text-xl tracking-[0.3em]" maxlength="6" />
        </div>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="codeVisible = false">取消</Button>
          <Button variant="gradient" :disabled="starting" @click="startByCode">
            <Loader2 v-if="starting" class="w-4 h-4 animate-spin" />
            开始使用
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { io, Socket } from 'socket.io-client'
import {
  getLaserDevices, createLaserSession, getMyLaserSessions,
  startLaserSession, endLaserSession, cancelLaserSession,
} from '@/api'
import { toast } from '@/composables/useToast'
import {
  Flame, X, Loader2, Square, QrCode, RefreshCw, CalendarClock, Info,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Label from '@/components/ui/Label.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'

const route = useRoute()

const devices = ref<any[]>([])
const mine = ref<any[]>([])
const loading = ref(false)
const booking = ref(false)
const starting = ref(false)

// 预约弹窗
const bookVisible = ref(false)
const bookDevice = ref<any>(null)
const bookMinutes = ref(60)
const bookPurpose = ref('')

// 核销码弹窗
const codeVisible = ref(false)
const codeInput = ref('')

let socket: Socket | null = null

onMounted(async () => {
  await Promise.all([loadDevices(), loadMine()])
  // WS：设备实时状态刷新可预约性
  socket = io('/devices', { auth: { token: localStorage.getItem('token') } })
  socket.on('device:public_status', (d: any) => {
    const i = devices.value.findIndex((x) => x.id === d.id)
    if (i >= 0) {
      const merged = { ...devices.value[i], ...d }
      merged.bookable = merged.online && merged.state === 'idle'
      devices.value[i] = merged
    }
  })
  // 扫设备二维码进入：/laser?start=DEVICE_ID 自动核销
  const startDevice = route.query.start as string
  if (startDevice) {
    try {
      const s = await startLaserSession({ deviceId: startDevice })
      toast.success(`已开始使用 ${s.device_id}，结束使用后自动结算`)
      loadMine()
    } catch {
      // 静默：无该设备的有效预约时提示打开核销码输入
      codeVisible.value = true
    }
  }
})

onUnmounted(() => socket?.disconnect())

async function loadDevices() {
  loading.value = true
  try {
    devices.value = await getLaserDevices()
  } finally {
    loading.value = false
  }
}

async function loadMine() {
  mine.value = await getMyLaserSessions()
}

const activeSession = computed(() => mine.value.find((s) => s.status === 'in_use'))
const approvedSessions = computed(() => mine.value.filter((s) => s.status === 'approved'))
const estimatedCost = computed(() =>
  ((bookDevice.value?.pricePerMinute ?? 0) * bookMinutes.value).toFixed(2),
)

function openBook(d: any) {
  bookDevice.value = d
  bookMinutes.value = 60
  bookPurpose.value = ''
  bookVisible.value = true
}

async function confirmBook() {
  booking.value = true
  try {
    await createLaserSession({
      deviceId: bookDevice.value.id,
      plannedMinutes: bookMinutes.value,
      purpose: bookPurpose.value.trim() || undefined,
    })
    toast.success('预约已提交，等待管理员审核')
    bookVisible.value = false
    await loadMine()
    await loadDevices()
  } finally {
    booking.value = false
  }
}

async function startByDevice(s: any) {
  starting.value = true
  try {
    await startLaserSession({ deviceId: s.device_id })
    toast.success('核销成功，开始计时')
    await loadMine()
  } finally {
    starting.value = false
  }
}

async function startByCode() {
  if (!/^\d{6}$/.test(codeInput.value.trim())) return toast.warning('请输入 6 位核销码')
  starting.value = true
  try {
    await startLaserSession({ code: codeInput.value.trim() })
    toast.success('核销成功，开始计时')
    codeVisible.value = false
    codeInput.value = ''
    await loadMine()
  } finally {
    starting.value = false
  }
}

async function endSession(s: any) {
  const r = await endLaserSession(s.id)
  toast.success(`已结算：${r.actual_minutes} 分钟，费用 ¥${r.fee}（实扣 ¥${r.fee_charged}）`)
  await loadMine()
  await loadDevices()
}

async function cancelSession(s: any) {
  await cancelLaserSession(s.id)
  toast.success('已取消预约')
  await loadMine()
  await loadDevices()
}

// ===== 展示映射 =====
function categoryLabel(c: string) {
  return c === 'laser' ? '激光设备' : c === 'uv' ? 'UV 打印机' : c
}
function stateLabel(s: string) {
  const m: Record<string, string> = {
    unknown: '未知', offline: '离线', idle: '空闲', working: '作业中',
    paused: '已暂停', error: '错误', maintenance: '维护中',
  }
  return m[s] || s
}
function bookableHint(d: any) {
  if (!d.online) return '离线'
  if (d.state !== 'idle') return '使用中'
  return '不可预约'
}

const STATUS_MAP: Record<string, { label: string; badge: any }> = {
  pending_review: { label: '待审核', badge: 'warning' },
  approved: { label: '已批准', badge: 'info' },
  in_use: { label: '使用中', badge: 'default' },
  completed: { label: '已完成', badge: 'success' },
  rejected: { label: '已驳回', badge: 'destructive' },
  cancelled: { label: '已取消', badge: 'secondary' },
  expired: { label: '已失效', badge: 'secondary' },
}
function statusLabel(s: string) { return STATUS_MAP[s]?.label || s }
function statusBadge(s: string) { return STATUS_MAP[s]?.badge || 'secondary' }

const steps = [
  '选择设备提交预约（无需上传文件），填写计划时长与用途',
  '管理员审核，通过后核销码将发送至你的邮箱',
  '在有效期内到设备现场，点击「我已到场，开始使用」或扫描设备二维码',
  '使用完毕点击「结束使用」，系统按实际分钟数自动从余额结算',
]
</script>
