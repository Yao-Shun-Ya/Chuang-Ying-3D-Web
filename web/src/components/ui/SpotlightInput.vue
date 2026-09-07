<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  class?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const visible = ref(false)
const mouseX = ref(0)
const mouseY = ref(0)
const radius = 100

function onMouseMove(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

const bg = ref('')
function updateBg() {
  const r = visible.value ? radius : 0
  bg.value = `radial-gradient(${r}px circle at ${mouseX.value}px ${mouseY.value}px, #6366f1, transparent 80%)`
}
</script>

<template>
  <div
    class="group/input rounded-lg p-[2px] transition duration-300"
    :style="{ background: bg }"
    @mousemove="onMouseMove; updateBg()"
    @mouseenter="visible = true; updateBg()"
    @mouseleave="visible = false; updateBg()"
  >
    <input
      :type="type || 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      :class="cn(
        'flex h-11 w-full rounded-md border-none bg-background px-3.5 py-2 text-sm text-foreground transition duration-300 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        $props.class,
      )"
    />
  </div>
</template>
