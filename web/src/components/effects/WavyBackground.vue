<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { createNoise3D } from 'simplex-noise'

const props = withDefaults(
  defineProps<{
    colors?: string[]
    waveWidth?: number
    blur?: number
    speed?: 'slow' | 'fast'
    waveOpacity?: number
  }>(),
  {
    colors: () => ['#6366f1', '#8b5cf6', '#c084fc', '#e879f9', '#22d3ee'],
    waveWidth: 50,
    blur: 10,
    speed: 'fast',
    waveOpacity: 0.5,
  },
)

const canvasRef = ref<HTMLCanvasElement>()
let animationId = 0

const getSpeed = () => (props.speed === 'slow' ? 0.001 : 0.002)

onMounted(() => {
  const canvas = canvasRef.value!
  const ctx = canvas.getContext('2d')!
  const noise = createNoise3D()
  let w = (canvas.width = window.innerWidth)
  let h = (canvas.height = window.innerHeight)
  ctx.filter = `blur(${props.blur}px)`
  let nt = 0

  const onResize = () => {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
    ctx.filter = `blur(${props.blur}px)`
  }
  window.addEventListener('resize', onResize)

  const drawWave = (n: number) => {
    nt += getSpeed()
    for (let i = 0; i < n; i++) {
      ctx.beginPath()
      ctx.lineWidth = props.waveWidth
      ctx.strokeStyle = props.colors[i % props.colors.length]
      for (let x = 0; x < w; x += 5) {
        const y = noise(x / 800, 0.3 * i, nt) * 100
        ctx.lineTo(x, y + h * 0.5)
      }
      ctx.stroke()
      ctx.closePath()
    }
  }

  const render = () => {
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.globalAlpha = props.waveOpacity
    ctx.clearRect(0, 0, w, h)
    drawWave(5)
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
  <div class="absolute inset-0 z-0 overflow-hidden">
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full"></canvas>
  </div>
</template>
