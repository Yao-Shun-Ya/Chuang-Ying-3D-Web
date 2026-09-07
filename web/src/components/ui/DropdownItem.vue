<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ class?: string }>()
</script>

<template>
  <button
    :class="cn(
      'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer text-left',
      $props.class,
    )"
  >
    <slot />
  </button>
</template>
