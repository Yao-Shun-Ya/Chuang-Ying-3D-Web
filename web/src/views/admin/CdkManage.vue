<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">CDK 管理</h1>
      <p class="text-muted-foreground mt-1">批量生成 CDK 兑换码</p>
    </div>

    <!-- Generate form -->
    <div class="rounded-2xl border border-border bg-card p-6 shadow-soft mb-6">
      <div class="flex items-center gap-2 mb-5">
        <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Ticket class="w-5 h-5 text-primary" />
        </div>
        <h3 class="text-lg font-semibold">批量生成 CDK</h3>
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-2">
          <Label>面值（元）</Label>
          <Input v-model.number="value" type="number" min="1" max="1000" class="w-32" />
        </div>
        <div class="space-y-2">
          <Label>数量</Label>
          <Input v-model.number="count" type="number" min="1" max="100" class="w-32" />
        </div>
        <Button variant="gradient" :disabled="generating" @click="generate">
          <Loader2 v-if="generating" class="w-4 h-4 animate-spin" />
          {{ generating ? '生成中...' : '生成' }}
        </Button>
      </div>
    </div>

    <!-- List -->
    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-border">
        <h3 class="text-lg font-semibold">CDK 列表</h3>
        <div class="flex gap-2">
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
            <TableHead>CDK 码</TableHead>
            <TableHead>面值</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>生成时间</TableHead>
            <TableHead>兑换时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="c in list" :key="c.id">
            <TableCell class="font-mono text-xs">{{ c.code }}</TableCell>
            <TableCell>¥{{ c.value }}</TableCell>
            <TableCell>
              <Badge :variant="c.status === 'unused' ? 'success' : 'secondary'">
                {{ c.status === 'unused' ? '未使用' : '已使用' }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ c.created_at }}</TableCell>
            <TableCell class="text-muted-foreground">{{ c.redeemed_at || '-' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { generateCdk, listCdk } from '@/api'
import { toast } from '@/composables/useToast'
import { Ticket, Loader2 } from 'lucide-vue-next'
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

const value = ref(50)
const count = ref(10)
const generating = ref(false)
const list = ref<any[]>([])
const status = ref('')

const filters = [
  { value: '', label: '全部' },
  { value: 'unused', label: '未使用' },
  { value: 'used', label: '已使用' },
]

onMounted(() => loadList())

async function loadList() {
  list.value = await listCdk(status.value || undefined)
}

async function generate() {
  generating.value = true
  try {
    await generateCdk(value.value, count.value)
    toast.success(`成功生成 ${count.value} 张 CDK`)
    loadList()
  } finally {
    generating.value = false
  }
}
</script>
