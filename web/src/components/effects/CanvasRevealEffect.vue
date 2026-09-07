<template>
  <div class="canvas-reveal" ref="wrapRef">
    <canvas ref="canvasRef"></canvas>
    <div class="reveal-overlay" v-if="showGradient"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** 0.1 慢 ~ 1.0 快 */
  animationSpeed?: number
  /** 点大小 */
  dotSize?: number
  /** 点阵间距 */
  gap?: number
  /** RGB 颜色组 */
  colors?: number[][]
  /** 是否显示渐变遮罩 */
  showGradient?: boolean
  /** 是否激活播放（由父级 hover 控制） */
  active?: boolean
}>(), {
  animationSpeed: 0.12,
  dotSize: 2,
  gap: 4,
  colors: () => [[148, 163, 184], [165, 180, 252]],
  showGradient: true,
  active: false,
})

const wrapRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let startTime = 0
let active = false
let dpr = 1

function resize() {
  if (!wrapRef.value || !canvasRef.value) return
  const w = wrapRef.value.clientWidth
  const h = wrapRef.value.clientHeight
  dpr = window.devicePixelRatio || 1
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'
  ctx = canvasRef.value.getContext('2d')
}

function draw() {
  if (!ctx || !canvasRef.value) return
  const w = canvasRef.value.width
  const h = canvasRef.value.height
  ctx.clearRect(0, 0, w, h)

  const t = (Date.now() - startTime) / 1000
  const gap = props.gap * dpr
  const dotR = (props.dotSize / 2) * dpr
  const cols = Math.ceil(w / gap)
  const rows = Math.ceil(h / gap)
  const cx = w / 2
  const cy = h / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * gap + gap / 2
      const y = j * gap + gap / 2
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      // 从中心向外扩散的波前
      const waveFront = t * props.animationSpeed * 60
      const reveal = Math.max(0, Math.min(1, (waveFront - dist / maxDist * 2 + 1) / 1.2))
      if (reveal <= 0) continue

      // 伪随机，基于网格位置
      const rand = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1
      const colorIdx = Math.floor(rand * props.colors.length)
      const color = props.colors[colorIdx]

      const opacity = reveal * (0.3 + rand * 0.7)
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`
      ctx.beginPath()
      ctx.arc(x, y, dotR * (0.5 + reveal * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  rafId = requestAnimationFrame(draw)
}

function start() {
  if (active) return
  active = true
  startTime = Date.now()
  draw()
}
function stop() {
  active = false
  cancelAnimationFrame(rafId)
  if (ctx && canvasRef.value) ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
}

function onEnter() { start() }
function onLeave() { stop() }

onMounted(() => {
  resize()
  if (props.active) start()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', resize)
})

watch(() => props.active, (v) => { v ? start() : stop() })
</script>

<style scoped>
.canvas-reveal {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
.canvas-reveal canvas {
  display: block;
}
.reveal-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.4) 70%, rgba(255, 255, 255, 0.85) 100%);
  pointer-events: none;
}
</style>
