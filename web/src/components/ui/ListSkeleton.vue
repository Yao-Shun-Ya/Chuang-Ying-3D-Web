<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import Table from './Table.vue'
import TableHeader from './TableHeader.vue'
import TableBody from './TableBody.vue'
import TableRow from './TableRow.vue'
import TableHead from './TableHead.vue'
import TableCell from './TableCell.vue'

const props = withDefaults(defineProps<{ columns?: number; rows?: number }>(), {
  columns: 5,
  rows: 6,
})
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead v-for="i in props.columns" :key="i">
          <Skeleton class="h-4 w-20" />
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="r in props.rows" :key="r">
        <TableCell v-for="c in props.columns" :key="c">
          <Skeleton class="h-4 w-full" />
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
