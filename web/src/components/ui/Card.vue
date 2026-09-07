<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('rounded-2xl border border-border bg-card text-card-foreground shadow-soft transition-shadow duration-300', $props.class)">
    <slot />
  </div>
</template>
