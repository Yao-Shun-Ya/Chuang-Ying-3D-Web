<script setup lang="ts">
/**
 * 环境背景：Sparkles + 渐变波浪 + 网格 vertex 效果
 * 纯 CSS 实现，性能友好，用于增强页面视觉层次
 */
defineProps<{ variant?: 'sparkles' | 'waves' | 'grid' | 'mixed' }>()
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <!-- 渐变波浪 blob -->
    <div class="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px] animate-float-slow"></div>
    <div class="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-accent/12 blur-[120px] animate-float" style="animation-delay: -2s"></div>
    <div class="absolute bottom-0 left-1/4 w-[450px] h-[450px] rounded-full bg-pink-400/10 blur-[120px] animate-float-slow" style="animation-delay: -4s"></div>

    <!-- 网格 vertex -->
    <div
      v-if="variant !== 'waves'"
      class="absolute inset-0 opacity-[0.04]"
      style="background-image: linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);"
    ></div>

    <!-- Sparkles -->
    <div v-if="variant !== 'waves'" class="absolute inset-0">
      <span
        v-for="n in 24"
        :key="n"
        class="absolute rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)]"
        :style="sparkleStyle(n)"
      ></span>
    </div>
  </div>
</template>

<script lang="ts">
function sparkleStyle(n: number) {
  // 伪随机但确定的位置/尺寸/动画
  const size = (n % 3) + 1
  const top = (n * 37) % 100
  const left = (n * 53) % 100
  const delay = (n % 6) * 0.5
  const dur = 2.5 + (n % 4)
  return {
    width: size + 'px',
    height: size + 'px',
    top: top + '%',
    left: left + '%',
    animation: `sparkle ${dur}s ease-in-out ${delay}s infinite`,
  }
}
</script>

<style>
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}
</style>
