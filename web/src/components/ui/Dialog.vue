<script setup lang="ts">
import { watch } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ modelValue: boolean; class?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div
          :class="cn(
            'relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl',
            $props.class,
          )"
        >
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-active > div:last-child,
.dialog-leave-active > div:last-child {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from > div:last-child,
.dialog-leave-to > div:last-child {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
