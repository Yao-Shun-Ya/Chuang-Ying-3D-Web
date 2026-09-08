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
            <TableCell>{{ o.volume }}</TableCell>
            <TableCell>¥{{ o.cost }}</TableCell>
            <TableCell><Badge :variant="statusBadge(o.status)">{{ statusLabel(o.status) }}</Badge></TableCell>
            <TableCell class="text-muted-foreground">{{ o.created_at }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" @click="preview(o)"><Eye class="w-4 h-4" /></Button>
                <Button v-if="o.status === 'pending_review'" variant="default" size="sm" @click="approve(o)">通过</Button>
                <Button v-if="o.status === 'pending_review'" variant="destructive" size="sm" @click="reject(o)">驳回</Button>
                <Button v-if="o.status === 'approved'" variant="default" size="sm" @click="updateStatus(o, 'printing')">开始打印</Button>
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
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { listAllOrders, approveOrder, rejectOrder, updateOrderStatus } from '@/api'
import { toast } from '@/composables/useToast'
import { userDisplayName } from '@/lib/utils'
import { Eye, X } from 'lucide-vue-next'
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

const filters = [
  { value: '', label: '全部' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'printing', label: '打印中' },
  { value: 'completed', label: '已完成' },
  { value: 'picked_up', label: '已取件' },
]

onMounted(() => loadList())

async function loadList() {
  list.value = await listAllOrders(status.value || undefined)
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
