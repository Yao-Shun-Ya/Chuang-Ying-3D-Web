<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">余额中心</h1>
      <p class="text-muted-foreground mt-1">管理你的 CDK 兑换与账户流水</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Balance card -->
      <div class="relative overflow-hidden rounded-2xl gradient-bg p-8 text-white shadow-lift">
        <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
        <div class="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10 blur-2xl"></div>
        <div class="relative">
          <div class="flex items-center gap-2 text-white/80 text-sm mb-3">
            <Wallet class="w-4 h-4" /> 当前账户余额
          </div>
          <div class="flex items-baseline gap-1">
            <span class="text-2xl">¥</span>
            <span class="text-6xl font-bold tracking-tight">{{ balance.toFixed(2) }}</span>
          </div>
          <Button variant="secondary" size="sm" class="mt-6 bg-white/15 text-white border-0 hover:bg-white/25" @click="loadBalance">
            <RefreshCw class="w-4 h-4" /> 刷新余额
          </Button>
        </div>
      </div>

      <!-- CDK redeem -->
      <div class="rounded-2xl border border-border bg-card p-8 shadow-soft">
        <div class="flex items-center gap-2 mb-5">
          <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ticket class="w-5 h-5 text-primary" />
          </div>
          <h3 class="text-lg font-semibold">CDK 兑换</h3>
        </div>
        <Label class="mb-2 block">兑换码</Label>
        <div class="flex gap-3">
          <Input v-model="cdkCode" placeholder="请输入 CDK 兑换码" @keyup.enter="redeem" />
          <Button variant="gradient" :disabled="redeeming || !cdkCode.trim()" @click="redeem">
            <Loader2 v-if="redeeming" class="w-4 h-4 animate-spin" />
            {{ redeeming ? '兑换中' : '兑换' }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground mt-3">购买 CDK 后输入兑换码即可充值虚拟余额，不涉及真实资金。</p>
      </div>
    </div>

    <!-- Transactions -->
    <div class="mt-8 rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-border">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <History class="w-5 h-5 text-primary" /> 流水记录
        </h3>
      </div>
      <div v-if="!transactions.length" class="p-12 text-center text-muted-foreground">
        <Receipt class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>暂无流水记录</p>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>操作后余额</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="t in transactions" :key="t.id">
            <TableCell class="text-muted-foreground">{{ t.created_at }}</TableCell>
            <TableCell>
              <Badge :variant="typeBadge(t.type)">{{ typeLabel(t.type) }}</Badge>
            </TableCell>
            <TableCell>
              <span :class="t.type === 'deduct' ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'">
                {{ t.type === 'deduct' ? '-' : '+' }}¥{{ t.amount }}
              </span>
            </TableCell>
            <TableCell>¥{{ t.balance_after }}</TableCell>
            <TableCell class="text-muted-foreground">{{ t.remark || '-' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { redeemCdk, getBalance, getMyTransactions } from '@/api'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import { Wallet, Ticket, RefreshCw, History, Receipt, Loader2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Badge from '@/components/ui/Badge.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'

const userStore = useUserStore()
const balance = ref(0)
const cdkCode = ref('')
const redeeming = ref(false)
const transactions = ref<any[]>([])

onMounted(() => {
  loadBalance()
  loadTransactions()
})

async function loadBalance() {
  const res = await getBalance()
  balance.value = res.balance
  userStore.setBalance(res.balance)
}

async function loadTransactions() {
  transactions.value = await getMyTransactions()
}

async function redeem() {
  if (!cdkCode.value.trim()) return toast.warning('请输入 CDK 码')
  redeeming.value = true
  try {
    const res = await redeemCdk(cdkCode.value.trim())
    toast.success(`兑换成功，到账 ¥${res.value}`)
    cdkCode.value = ''
    balance.value = res.balance
    userStore.setBalance(res.balance)
    loadTransactions()
  } finally {
    redeeming.value = false
  }
}

function typeLabel(t: string) {
  return { recharge: '充值', deduct: '扣费', refund: '退款' }[t] || t
}
function typeBadge(t: string) {
  return ({ recharge: 'success', deduct: 'destructive', refund: 'warning' } as const)[t] || 'info'
}
</script>
