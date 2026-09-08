<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">用户管理</h1>
      <p class="text-muted-foreground mt-1">平台注册用户列表</p>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>学号</TableHead>
            <TableHead>余额</TableHead>
            <TableHead>注册时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="u in list" :key="u.id">
            <TableCell class="text-muted-foreground">#{{ u.id }}</TableCell>
            <TableCell class="font-medium">{{ userDisplayName(u) }}</TableCell>
            <TableCell class="text-muted-foreground">{{ u.email || '-' }}</TableCell>
            <TableCell>{{ u.real_name || '-' }}</TableCell>
            <TableCell>{{ u.student_no || '-' }}</TableCell>
            <TableCell>¥{{ u.balance }}</TableCell>
            <TableCell class="text-muted-foreground">{{ u.created_at }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, onMounted } from 'vue'
import { listUsers } from '@/api'
import { userDisplayName } from '@/lib/utils'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'

const list = ref<any[]>([])

onMounted(async () => {
  list.value = await listUsers()
})
</script>
