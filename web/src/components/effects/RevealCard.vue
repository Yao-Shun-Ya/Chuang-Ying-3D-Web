<template>
  <div
    class="reveal-card group"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <CanvasRevealEffect
      :active="hovered"
      :colors="colors"
      :dot-size="dotSize"
      :animation-speed="animationSpeed"
      :show-gradient="false"
    />
    <!-- 悬停渐变光晕 -->
    <div class="reveal-glow" :class="{ 'opacity-100': hovered }"></div>
    <div class="reveal-content relative z-10">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CanvasRevealEffect from './CanvasRevealEffect.vue'

withDefaults(defineProps<{
  colors?: number[][]
  dotSize?: number
  animationSpeed?: number
}>(), {
  colors: () => [[148, 163, 184], [165, 180, 252]],
  dotSize: 2,
  animationSpeed: 0.12,
})

const hovered = ref(false)
</script>

<style scoped>
.reveal-card {
  position: relative;
  border-radius: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1),
              box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1),
              border-color 0.4s ease;
  will-change: transform;
}
.reveal-card:hover {
  transform: translateY(-4px);
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow:
    0 20px 40px rgba(99, 102, 241, 0.12),
    0 8px 16px rgba(0, 0, 0, 0.06);
}
.reveal-glow {
  position: absolute;
  inset: -1px;
  border-radius: 1rem;
  background: radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), rgba(99, 102, 241, 0.1), transparent 40%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.reveal-content {
  position: relative;
}
</style>
