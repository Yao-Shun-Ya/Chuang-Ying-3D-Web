<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    minSize?: number
    maxSize?: number
    speed?: number
    particleColor?: string
    particleDensity?: number
  }>(),
  {
    minSize: 1,
    maxSize: 3,
    speed: 4,
    particleColor: '#ffffff',
    particleDensity: 120,
  },
)

const canvasRef = ref<HTMLCanvasElement>()
let animationId = 0

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

onMounted(() => {
  const canvas = canvasRef.value!
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(props.particleColor)
  let w = (canvas.width = canvas.offsetWidth || window.innerWidth)
  let h = (canvas.height = canvas.offsetHeight || window.innerHeight)

  const count = Math.round((w * h) / (400 * 400) * props.particleDensity)
  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: props.minSize + Math.random() * (props.maxSize - props.minSize),
    baseOpacity: 0.1 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
  }))

  const onResize = () => {
    w = canvas.width = canvas.offsetWidth
    h = canvas.height = canvas.offsetHeight
  }
  window.addEventListener('resize', onResize)

  let t = 0
  const render = () => {
    t += 0.016
    ctx.clearRect(0, 0, w, h)
    for (const p of particles) {
      const opacity = p.baseOpacity * (0.5 + 0.5 * Math.sin(t * props.speed + p.phase))
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
      ctx.fill()
    }
    animationId = requestAnimationFrame(render)
  }
  render()

  onBeforeUnmount(() => {
    cancelAnimationFrame(animationId)
    window.removeEventListener('resize', onResize)
  })
})
</script>

<template>
  <canvas ref="canvasRef" class="h-full w-full block"></canvas>
</template>
