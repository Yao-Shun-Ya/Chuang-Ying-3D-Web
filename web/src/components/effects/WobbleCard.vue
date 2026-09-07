<template>
  <section
    class="wobble-card"
    @mousemove="onMouseMove"
    @mouseenter="isHovering = true"
    @mouseleave="onLeave"
    :style="containerStyle"
  >
    <div class="wobble-inner" :style="innerStyle">
      <div class="wobble-noise"></div>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 跟随灵敏度，越大越明显 */
  intensity?: number
  /** 内容层反向移动比例 */
  parallax?: number
}>(), {
  intensity: 20,
  parallax: 1.4,
})

const mousePos = ref({ x: 0, y: 0 })
const isHovering = ref(false)

function onMouseMove(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (e.clientX - (rect.left + rect.width / 2)) / props.intensity
  const y = (e.clientY - (rect.top + rect.height / 2)) / props.intensity
  mousePos.value = { x, y }
}

function onLeave() {
  isHovering.value = false
  mousePos.value = { x: 0, y: 0 }
}

const containerStyle = computed(() => ({
  transform: isHovering.value
    ? `translate3d(${mousePos.value.x}px, ${mousePos.value.y}px, 0)`
    : 'translate3d(0, 0, 0)',
  transition: isHovering.value ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
}))

const innerStyle = computed(() => ({
  transform: isHovering.value
    ? `translate3d(${-mousePos.value.x * props.parallax}px, ${-mousePos.value.y * props.parallax}px, 0) scale(1.02)`
    : 'translate3d(0, 0, 0) scale(1)',
  transition: isHovering.value ? 'transform 0.1s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
}))
</script>

<style scoped>
.wobble-card {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  will-change: transform;
  transform-style: preserve-3d;
  perspective: 1000px;
}

.wobble-inner {
  position: relative;
  height: 100%;
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%);
  box-shadow:
    0 10px 32px rgba(34, 42, 53, 0.08),
    0 1px 1px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(99, 102, 241, 0.06),
    0 4px 6px rgba(34, 42, 53, 0.05),
    0 24px 108px rgba(99, 102, 241, 0.06);
  will-change: transform;
}

/* 噪点纹理 */
.wobble-noise {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.06;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 128px;
  mix-blend-mode: overlay;
  -webkit-mask-image: radial-gradient(circle at center, #000 30%, transparent 80%);
  mask-image: radial-gradient(circle at center, #000 30%, transparent 80%);
}
</style>
