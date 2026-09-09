<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">订单审核</h1>
      <p class="text-muted-foreground mt-1">审核订单并管理打印状态流转</p>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-border">
        <h3 class="text-lg font-semibold">订单列表</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in filters"
            :key="s.value"
            @click="status = s.value; loadList()"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              status === s.value ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
            ]"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>订单号</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>模型</TableHead>
            <TableHead>打印配置</TableHead>
            <TableHead>体积</TableHead>
            <TableHead>费用</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="o in list" :key="o.id">
            <TableCell class="font-mono text-xs">{{ o.order_no }}</TableCell>
            <TableCell>{{ userDisplayName(o) }}</TableCell>
            <TableCell>{{ o.model_name }}</TableCell>
            <TableCell>
              <div class="space-y-1">
                <p class="text-xs font-medium flex items-center gap-1">
                  <Printer class="w-3.5 h-3.5 text-sky-600" />
                  {{ printerNameOf(o) }}
                </p>
                <div class="flex flex-wrap gap-1">
                  <Badge v-if="o.print_params?.infillRate != null" variant="secondary" class="text-[10px]">填充 {{ Math.round(o.print_params.infillRate * 100) }}%</Badge>
                  <Badge v-if="o.print_params?.supports != null" variant="secondary" class="text-[10px]">支撑 {{ supportLabel(o.print_params.supports) }}</Badge>
                  <Badge v-if="o.print_params?.color" variant="secondary" class="text-[10px]">
                    <span class="w-2 h-2 rounded-full mr-1 border border-black/20" :style="{ backgroundColor: colorHex(o.print_params.color) }"></span>
                    {{ o.print_params.color }}
                  </Badge>
                </div>
              </div>
            </TableCell>
            <TableCell>{{ o.volume }}</TableCell>
            <TableCell>¥{{ o.cost }}</TableCell>
            <TableCell><Badge :variant="statusBadge(o.status)">{{ statusLabel(o.status) }}</Badge></TableCell>
            <TableCell class="text-muted-foreground">{{ o.created_at }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" @click="preview(o)"><Eye class="w-4 h-4" /></Button>
                <Button v-if="o.status === 'pending_review'" variant="default" size="sm" @click="approve(o)">通过</Button>
                <Button v-if="o.status === 'pending_review'" variant="destructive" size="sm" @click="reject(o)">驳回</Button>
                <Button v-if="o.status === 'approved'" variant="default" size="sm" @click="openPrint(o)">开始打印</Button>
                <Button v-if="o.status === 'printing'" variant="default" size="sm" @click="updateStatus(o, 'completed')">完成打印</Button>
                <Button v-if="o.status === 'completed'" variant="default" size="sm" @click="updateStatus(o, 'picked_up')">确认取件</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Reject dialog -->
    <Dialog v-model="rejectVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">驳回订单</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="rejectVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-2">
          <Label>驳回理由</Label>
          <Textarea v-model="rejectReason" placeholder="请填写驳回理由，将退款至用户余额" rows="4" />
        </div>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="rejectVisible = false">取消</Button>
          <Button variant="destructive" @click="confirmReject">确认驳回</Button>
        </div>
      </div>
    </Dialog>

    <!-- Start print dialog：绑定打印机 -->
    <Dialog v-model="printVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">开始打印</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="printVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <p class="text-sm text-muted-foreground">
          订单 <span class="font-mono">{{ current?.order_no }}</span> · {{ current?.model_name }}
        </p>
        <div class="space-y-2">
          <Label>绑定打印机</Label>
          <p class="text-xs text-muted-foreground">绑定后订单将随该打印机完成作业自动流转为「已完成」</p>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <button
              v-for="p in printers" :key="p.id"
              @click="printerId = p.id"
              :class="[
                'w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all',
                printerId === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Printer class="w-4 h-4 text-sky-600 shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ p.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ p.model || '打印机' }}</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <Badge :variant="p.state === 'idle' ? 'success' : 'warning'">{{ stateLabel(p.state) }}</Badge>
                <Badge :variant="p.online ? 'success' : 'secondary'">{{ p.online ? '在线' : '离线' }}</Badge>
              </div>
            </button>
            <p v-if="!printers.length" class="text-center text-sm text-muted-foreground py-4">暂无可用打印机</p>
          </div>
        </div>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="printVisible = false">取消</Button>
          <Button variant="gradient" :disabled="!printerId" @click="confirmPrint">
            <Loader2 v-if="printing" class="w-4 h-4 animate-spin" />
            {{ printing ? '下发中...' : '开始打印' }}
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { listAllOrders, approveOrder, rejectOrder, updateOrderStatus, listDevices } from '@/api'
import { toast } from '@/composables/useToast'
import { userDisplayName } from '@/lib/utils'
import { Eye, X, Printer, Loader2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Label from '@/components/ui/Label.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'

const list = ref<any[]>([])
const status = ref('pending_review')
const rejectVisible = ref(false)
const rejectReason = ref('')
const current = ref<any>(null)

// 开始打印：绑定打印机
const printVisible = ref(false)
const printers = ref<any[]>([])
const printerId = ref('')
const printing = ref(false)

onMounted(() => {
  loadList()
  loadPrinters()
})

async function loadList() {
  list.value = await listAllOrders(status.value || undefined)
}

async function loadPrinters() {
  try {
    printers.value = (await listDevices()).filter((d: any) => d.category === 'fdm')
  } catch {
    printers.value = []
  }
}

function openPrint(row: any) {
  current.value = row
  // 学生下单已指定设备时预选，管理员可改选
  printerId.value = row.printer_device_id || ''
  printVisible.value = true
}

/** 订单绑定设备名（学生指定或管理员改绑） */
function printerNameOf(o: any) {
  if (!o.printer_device_id) return '管理员分配'
  return printers.value.find((p) => p.id === o.printer_device_id)?.name || o.printer_device_id
}

const SUPPORT_LABEL: Record<number, string> = { 0: '无', 25: '轻度', 50: '标准', 100: '密集' }
function supportLabel(v: number) { return SUPPORT_LABEL[v] || String(v) }

const COLOR_HEX: Record<string, string> = {
  '白色': '#f5f5f4', '黑色': '#1c1917', '灰色': '#9ca3af', '红色': '#ef4444',
  '蓝色': '#3b82f6', '绿色': '#22c55e', '黄色': '#eab308', '橙色': '#f97316',
  '紫色': '#a855f7', '透明': '#dbeafe',
}
function colorHex(name: string) { return COLOR_HEX[name] || '#9ca3af' }

async function confirmPrint() {
  if (!printerId.value) return
  printing.value = true
  try {
    await updateOrderStatus(current.value.id, 'printing', undefined, printerId.value)
    toast.success('已开始打印并绑定打印机（完成作业后自动流转）')
    printVisible.value = false
    loadList()
  } finally {
    printing.value = false
  }
}

const filters = [
  { value: '', label: '全部' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'printing', label: '打印中' },
  { value: 'completed', label: '已完成' },
  { value: 'picked_up', label: '已取件' },
]

function stateLabel(s: string) {
  const m: Record<string, string> = {
    unknown: '未知', offline: '离线', idle: '空闲', working: '作业中',
    paused: '已暂停', error: '错误', maintenance: '维护中',
  }
  return m[s] || s
}

function preview(row: any) {
  const token = localStorage.getItem('token') || ''
  fetch(`/api/models/${row.model_id}/file`, {
    headers: { Authorization: 'Bearer ' + token },
  })
    .then((res) => {
      if (!res.ok) throw new Error('下载失败')
      return res.blob()
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = row.model_name || `model_${row.model_id}.stl`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
    .catch(() => toast.error('模型文件下载失败'))
}

async function approve(row: any) {
  await approveOrder(row.id)
  toast.success('已通过并下发打印任务')
  loadList()
}

function reject(row: any) {
  current.value = row
  rejectReason.value = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回理由')
  await rejectOrder(current.value.id, rejectReason.value)
  toast.success('已驳回并退款')
  rejectVisible.value = false
  loadList()
}

async function updateStatus(row: any, to: string) {
  await updateOrderStatus(row.id, to)
  toast.success('状态已更新')
  loadList()
}

const STATUS_MAP: Record<string, { label: string; badge: any }> = {
  pending_review: { label: '待审核', badge: 'warning' },
  rejected: { label: '已驳回', badge: 'destructive' },
  approved: { label: '已通过', badge: 'info' },
  printing: { label: '打印中', badge: 'info' },
  completed: { label: '已完成', badge: 'success' },
  picked_up: { label: '已取件', badge: 'success' },
}
function statusLabel(s: string) { return STATUS_MAP[s]?.label || s }
function statusBadge(s: string) { return STATUS_MAP[s]?.badge || 'secondary' }
</script>
