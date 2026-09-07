<script setup lang="ts">
import { useAttrs } from 'vue'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const props = defineProps<{ modelValue?: string | number; class?: string; options?: { label: string; value: string | number }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <select
    :value="modelValue"
    :class="cn(
      'flex h-11 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
      $props.class,
    )"
    v-bind="attrs"
    @change="onChange"
  >
    <slot>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </slot>
  </select>
</template>
