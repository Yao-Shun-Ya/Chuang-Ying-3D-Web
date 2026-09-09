<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    content: string
    side?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
    class?: string
  }>(),
  { side: 'top', delay: 0 },
)

const show = ref(false)
const hasMouse = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

// 桌面端用 hover；触屏无 hover 则不展示（避免误触）
function onEnter() {
  hasMouse.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (show.value = true), props.delay)
}
function onLeave() {
  if (timer) clearTimeout(timer)
  show.value = false
}

onMounted(() => {
  const mq = window.matchMedia('(hover: hover)')
  hasMouse.value = mq.matches
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const tipClass = computed(() =>
  cn(
    'pointer-events-none absolute z-50 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap select-none',
    'bg-foreground text-background shadow-lg shadow-foreground/10',
    sideClass.value,
    show.value && hasMouse.value ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5',
    'transition-all duration-150',
  ),
)
const sideClass = computed(() => {
  switch (props.side) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-1.5'
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-1.5'
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-1.5'
  }
})
</script>

<template>
  <span class="relative inline-flex" @mouseenter="onEnter" @mouseleave="onLeave" :class="props.class">
    <slot />
    <span :class="tipClass">{{ content }}</span>
  </span>
</template>