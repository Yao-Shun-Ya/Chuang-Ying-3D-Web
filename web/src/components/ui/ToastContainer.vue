<script setup lang="ts">
import { useToasts } from '@/composables/useToast'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-vue-next'

const { toasts } = useToasts()

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}
const colors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lift min-w-[260px]"
        >
          <component :is="icons[t.type]" :class="['h-5 w-5 shrink-0', colors[t.type]]" />
          <span class="text-sm font-medium text-foreground flex-1">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>
