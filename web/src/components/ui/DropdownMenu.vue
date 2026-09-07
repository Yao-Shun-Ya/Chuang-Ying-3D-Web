<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{ align?: 'start' | 'end'; class?: string }>()

const open = ref(false)
const root = ref<HTMLElement>()

function toggle() {
  open.value = !open.value
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="root" class="relative inline-block" :class="$props.class">
    <div @click.stop="toggle">
      <slot name="trigger" :open="open" />
    </div>
    <Transition name="dropdown">
      <div
        v-if="open"
        @click.stop
        :class="cn(
          'absolute z-50 mt-2 min-w-[10rem] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg',
          align === 'end' ? 'right-0' : 'left-0',
        )"
      >
        <slot :close="() => (open = false)" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
