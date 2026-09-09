<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">我的订单</h1>
        <p class="text-muted-foreground mt-1">查看订单状态与打印进度</p>
      </div>
      <Button variant="outline" @click="loadOrders">
        <RefreshCw class="w-4 h-4" /> 刷新
      </Button>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <ListSkeleton v-if="loading" :columns="7" :rows="5" />
      <div v-else-if="!orders.length" class="p-16 text-center text-muted-foreground">
        <Package class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="font-medium">暂无订单</p>
        <Button variant="gradient" size="sm" class="mt-4" @click="$router.push('/upload')">
          去上传模型
        </Button>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>订单号</TableHead>
            <TableHead>模型</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>费用</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="o in orders" :key="o.id">
            <TableCell class="font-mono text-xs">{{ o.order_no }}</TableCell>
            <TableCell>{{ o.model_name }}</TableCell>
            <TableCell>{{ o.volume }} cm³</TableCell>
            <TableCell>¥{{ o.cost }}</TableCell>
            <TableCell>
              <Badge :variant="statusBadge(o.status)">{{ statusLabel(o.status) }}</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ o.created_at }}</TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" @click="showDetail(o)">
                <Eye class="w-4 h-4" /> 详情
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Detail Dialog -->
    <Dialog v-model="detailVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">订单详情</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="detailVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div v-if="current" class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground">订单号</p>
            <p class="font-mono text-sm font-medium mt-0.5">{{ current.order_no }}</p>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground">状态</p>
            <div class="mt-0.5"><Badge :variant="statusBadge(current.status)">{{ statusLabel(current.status) }}</Badge></div>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground">体积</p>
            <p class="font-medium mt-0.5">{{ current.volume }} cm³</p>
          </div>
          <div class="rounded-xl border border-border bg-secondary/30 p-3">
            <p class="text-xs text-muted-foreground">费用</p>
            <p class="font-medium mt-0.5">¥{{ current.cost }}</p>
          </div>
          <!-- 打印配置 -->
          <div v-if="hasPrintParams(current)" class="rounded-xl border border-border bg-secondary/30 p-3 col-span-2">
            <p class="text-xs text-muted-foreground mb-1.5">打印配置</p>
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="secondary">填充 {{ Math.round((current.print_params.infillRate ?? 0.2) * 100) }}%</Badge>
              <Badge variant="secondary">支撑 {{ supportLabel(current.print_params.supports ?? 0) }}</Badge>
              <Badge v-if="current.print_params.color" variant="secondary">
                <span class="w-2 h-2 rounded-full mr-1 border border-black/20" :style="{ backgroundColor: colorHex(current.print_params.color) }"></span>
                {{ current.print_params.color }}
              </Badge>
            </div>
          </div>
          <div v-if="printerOf(current)" class="rounded-xl border border-border bg-secondary/30 p-3 col-span-2">
            <p class="text-xs text-muted-foreground">打印设备</p>
            <p class="font-medium mt-0.5 flex items-center gap-2">
              <Printer class="w-4 h-4 text-sky-600" /> {{ printerOf(current)!.name }}
              <Badge :variant="printerOf(current)!.online ? 'success' : 'secondary'">
                {{ printerOf(current)!.online ? '在线' : '离线' }}
              </Badge>
            </p>
            <!-- 实时进度 -->
            <template v-if="printerOf(current)!.state === 'working' && printerOf(current)!.progress != null">
              <div class="mt-3">
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="text-muted-foreground">打印进度</span>
                  <span class="font-semibold text-primary">
                    {{ Math.round(printerOf(current)!.progress) }}%
                    <template v-if="printerOf(current)!.remainingMinutes != null">
                      （剩余 ~{{ printerOf(current)!.remainingMinutes }} 分钟）
                    </template>
                  </span>
                </div>
                <div class="h-2 rounded-full bg-secondary overflow-hidden">
                  <div class="h-full gradient-bg rounded-full transition-all duration-700"
                    :style="{ width: Math.min(100, printerOf(current)!.progress) + '%' }"></div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-if="current?.reject_reason" class="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p class="text-xs font-semibold text-amber-700 mb-1">驳回理由</p>
          <p class="text-sm text-amber-800">{{ current.reject_reason }}</p>
        </div>

        <div>
          <h4 class="text-sm font-semibold mb-3 text-muted-foreground">状态流转</h4>
          <div class="relative pl-6 space-y-4 border-l border-border ml-2">
            <div v-for="log in logs" :key="log.id" class="relative">
              <span class="absolute -left-[27px] top-1 w-3 h-3 rounded-full gradient-bg ring-4 ring-background"></span>
              <p class="text-sm font-medium">{{ statusLabel(log.to_status) }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">{{ log.created_at }}</p>
              <p v-if="log.remark" class="text-xs text-muted-foreground">{{ log.remark }}</p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { getMyOrders, getOrderLogs, getPublicDevices } from '@/api'
import { toast } from '@/composables/useToast'
import { RefreshCw, Loader2, Package, Eye, X, Printer } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'

const orders = ref<any[]>([])
const loading = ref(false)
const detailVisible = ref(false)
const current = ref<any>(null)
const logs = ref<any[]>([])
// 设备实时状态（打印进度展示）
const deviceMap = ref<Record<string, any>>({})
let deviceSocket: Socket | null = null
let orderSocket: Socket | null = null

onMounted(async () => {
  await loadOrders()
  // 拉取设备摘要 + WS 订阅实时进度
  try {
    for (const d of await getPublicDevices()) deviceMap.value[d.id] = d
  } catch { /* 设备接口不可用时不影响订单页 */ }
  deviceSocket = io('/devices', { auth: { token: localStorage.getItem('token') } })
  deviceSocket.on('device:public_status', (d: any) => {
    deviceMap.value[d.id] = { ...deviceMap.value[d.id], ...d }
  })
  orderSocket = io('/orders', { auth: { token: localStorage.getItem('token') } })
  orderSocket.on('order:status_changed', (data) => {
    toast.info(`订单 ${data.orderNo || data.orderId} 状态更新为 ${statusLabel(data.status)}`)
    loadOrders()
  })
})

onUnmounted(() => {
  deviceSocket?.disconnect()
  orderSocket?.disconnect()
})

/** 订单绑定的打印机实时状态 */
function printerOf(order: any) {
  return order.printer_device_id ? deviceMap.value[order.printer_device_id] : null
}

/** 是否携带打印配置 */
function hasPrintParams(order: any) {
  const p = order.print_params
  return p && (p.infillRate != null || p.supports != null || p.color)
}

const SUPPORT_LABEL: Record<number, string> = { 0: '无', 25: '轻度', 50: '标准', 100: '密集' }
function supportLabel(v: number) { return SUPPORT_LABEL[v] || String(v) }

const COLOR_HEX: Record<string, string> = {
  '白色': '#f5f5f4', '黑色': '#1c1917', '灰色': '#9ca3af', '红色': '#ef4444',
  '蓝色': '#3b82f6', '绿色': '#22c55e', '黄色': '#eab308', '橙色': '#f97316',
  '紫色': '#a855f7', '透明': '#dbeafe',
}
function colorHex(name: string) { return COLOR_HEX[name] || '#9ca3af' }

async function loadOrders() {
  loading.value = true
  try {
    orders.value = await getMyOrders()
  } finally {
    loading.value = false
  }
}

async function showDetail(row: any) {
  current.value = row
  logs.value = await getOrderLogs(row.id)
  detailVisible.value = true
}

const STATUS_MAP: Record<string, { label: string; badge: any }> = {
  pending_review: { label: '待审核', badge: 'warning' },
  rejected: { label: '已驳回', badge: 'destructive' },
  approved: { label: '审核通过', badge: 'info' },
  printing: { label: '打印中', badge: 'info' },
  completed: { label: '已完成', badge: 'success' },
  picked_up: { label: '已取件', badge: 'success' },
}
function statusLabel(s: string) {
  return STATUS_MAP[s]?.label || s
}
function statusBadge(s: string) {
  return STATUS_MAP[s]?.badge || 'secondary'
}
</script>
