<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">流水对账</h1>
        <p class="text-muted-foreground mt-1">查看全部账户流水并导出</p>
      </div>
      <Button variant="gradient" @click="exportCsv">
        <Download class="w-4 h-4" /> 导出 CSV
      </Button>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>操作后余额</TableHead>
            <TableHead>备注</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="t in list" :key="t.id">
            <TableCell class="text-muted-foreground">#{{ t.id }}</TableCell>
            <TableCell>{{ userDisplayName(t) }}</TableCell>
            <TableCell class="text-muted-foreground">{{ t.email || '-' }}</TableCell>
            <TableCell><Badge :variant="typeBadge(t.type)">{{ typeLabel(t.type) }}</Badge></TableCell>
            <TableCell>
              <span :class="t.type === 'deduct' ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'">
                {{ t.type === 'deduct' ? '-' : '+' }}¥{{ t.amount }}
              </span>
            </TableCell>
            <TableCell>¥{{ t.balance_after }}</TableCell>
            <TableCell class="text-muted-foreground">{{ t.remark || '-' }}</TableCell>
            <TableCell class="text-muted-foreground">{{ t.created_at }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { listAllTransactions, exportTransactions } from '@/api'
import { userDisplayName } from '@/lib/utils'
import { Download } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'

const list = ref<any[]>([])

onMounted(async () => {
  list.value = await listAllTransactions()
})

async function exportCsv() {
  const blob = await exportTransactions()
  const url = window.URL.createObjectURL(new Blob([blob]))
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions_${Date.now()}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

function typeLabel(t: string) {
  return { recharge: '充值', deduct: '扣费', refund: '退款' }[t] || t
}
function typeBadge(t: string) {
  return ({ recharge: 'success', deduct: 'destructive', refund: 'warning' } as const)[t] || 'info'
}
</script>
