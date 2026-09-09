<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">激光工坊管理</h1>
      <p class="text-muted-foreground mt-1">审核预约、核销授权与使用结算（按实际分钟计费）</p>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      <div v-for="s in statCards" :key="s.label"
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

    <!-- 会话列表 -->
    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-border">
        <h3 class="text-lg font-semibold">预约列表</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="f in filters" :key="f.value"
            @click="status = f.value; loadList()"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              status === f.value ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
            ]"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <ListSkeleton v-if="loading" :columns="6" :rows="4" />
      <div v-else-if="!list.length" class="p-16 text-center text-muted-foreground">
        <Flame class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="font-medium">暂无预约</p>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>设备</TableHead>
            <TableHead>计划时长</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>核销码 / 时间</TableHead>
            <TableHead>费用</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="s in list" :key="s.id">
            <TableCell class="font-mono text-xs">#{{ s.id }}</TableCell>
            <TableCell>
              <p class="text-sm font-medium">{{ s.display_name || s.username }}</p>
              <p class="text-xs text-muted-foreground">{{ s.email }}</p>
            </TableCell>
            <TableCell>
              <p class="text-sm">{{ s.device_name || s.device_id }}</p>
              <p class="text-xs text-muted-foreground">¥{{ s.price_per_minute ?? stats?.pricePerMinuteDefault ?? '-' }}/分钟</p>
            </TableCell>
            <TableCell>
              {{ s.planned_minutes }} 分钟
              <p v-if="s.purpose" class="text-xs text-muted-foreground truncate max-w-36" :title="s.purpose">{{ s.purpose }}</p>
            </TableCell>
            <TableCell>
              <Badge :variant="statusBadge(s.status)">{{ statusLabel(s.status) }}</Badge>
              <Badge v-if="s.underpaid" variant="destructive" class="ml-1">欠费</Badge>
            </TableCell>
            <TableCell class="text-xs">
              <template v-if="s.status === 'approved'">
                <span class="font-mono font-bold text-base text-primary tracking-widest">{{ s.verify_code }}</span>
                <p class="text-muted-foreground mt-0.5">失效：{{ s.expires_at }}</p>
              </template>
              <template v-else-if="s.status === 'in_use'">
                <p class="text-emerald-600 font-medium">开始于 {{ s.started_at }}</p>
              </template>
              <template v-else>
                <span class="text-muted-foreground">{{ s.created_at }}</span>
              </template>
            </TableCell>
            <TableCell>
              <template v-if="s.status === 'completed'">
                <p class="text-sm font-semibold">{{ s.actual_minutes }} 分钟</p>
                <p class="text-xs">
                  ¥{{ s.fee }} <template v-if="s.fee_charged !== s.fee">（实扣 ¥{{ s.fee_charged }}）</template>
                </p>
              </template>
              <span v-else class="text-muted-foreground">-</span>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1.5">
                <Button v-if="s.status === 'pending_review'" variant="default" size="sm" @click="approve(s)">通过</Button>
                <Button v-if="['pending_review', 'approved'].includes(s.status)" variant="destructive" size="sm" @click="openReject(s)" :title="s.status === 'approved' ? '学生未到场核销时释放设备' : ''">驳回</Button>
                <Button v-if="s.status === 'in_use'" variant="destructive" size="sm" @click="forceEnd(s)">强制结束</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- 驳回弹窗 -->
    <Dialog v-model="rejectVisible">
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">驳回预约</h3>
          <button class="text-muted-foreground hover:text-foreground" @click="rejectVisible = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-2">
          <Label>驳回理由</Label>
          <Textarea v-model="rejectReason" placeholder="请填写驳回理由，将通过邮件通知学生" rows="4" />
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
import { ref, onMounted, computed, markRaw } from 'vue'
import { listLaserSessions, getLaserStats, approveLaserSession, rejectLaserSession, forceEndLaserSession } from '@/api'
import { toast } from '@/composables/useToast'
import { Flame, X, Timer, AlertTriangle, Wallet } from 'lucide-vue-next'
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
import ListSkeleton from '@/components/ui/ListSkeleton.vue'

const list = ref<any[]>([])
const stats = ref<any>(null)
const status = ref('pending_review')
const loading = ref(false)
const rejectVisible = ref(false)
const rejectReason = ref('')
const current = ref<any>(null)

const filters = [
  { value: '', label: '全部' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已批准' },
  { value: 'in_use', label: '使用中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已驳回' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已失效' },
]

onMounted(() => {
  loadList()
  loadStats()
})

async function loadList() {
  loading.value = true
  try {
    list.value = await listLaserSessions(status.value || undefined)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  stats.value = await getLaserStats()
}

async function approve(row: any) {
  await approveLaserSession(row.id)
  toast.success(`预约 #${row.id} 已批准，核销码已通过邮件发送`)
  loadList()
  loadStats()
}

function openReject(row: any) {
  current.value = row
  rejectReason.value = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回理由')
  await rejectLaserSession(current.value.id, rejectReason.value)
  toast.success('已驳回并通过邮件通知')
  rejectVisible.value = false
  loadList()
  loadStats()
}

async function forceEnd(row: any) {
  const s = await forceEndLaserSession(row.id)
  toast.success(`已强制结束：${s.actual_minutes} 分钟，费用 ¥${s.fee}（实扣 ¥${s.fee_charged}）`)
  loadList()
  loadStats()
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

const statCards = computed(() => {
  const st = stats.value
  return [
    { label: '今日完成单数', value: st?.today?.count ?? 0, icon: markRaw(Flame), bg: 'bg-rose-100', color: 'text-rose-600' },
    { label: '今日使用分钟', value: st?.today?.minutes ?? 0, icon: markRaw(Timer), bg: 'bg-indigo-100', color: 'text-indigo-600' },
    { label: '今日收入(元)', value: Number(st?.today?.revenue ?? 0).toFixed(2), icon: markRaw(Wallet), bg: 'bg-emerald-100', color: 'text-emerald-600' },
    { label: '待审核 / 欠费', value: `${st?.pendingCount ?? 0} / ${st?.underpaidCount ?? 0}`, icon: markRaw(AlertTriangle), bg: 'bg-amber-100', color: 'text-amber-600' },
  ]
})
</script>
