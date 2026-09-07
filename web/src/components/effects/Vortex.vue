<template>
  <div class="relative h-full w-full" :class="containerClassName">
    <div ref="containerRef" class="absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-transparent">
      <canvas ref="canvasRef"></canvas>
    </div>
    <div class="relative z-10" :class="className">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createNoise3D } from 'simplex-noise'

interface VortexProps {
  containerClassName?: string
  className?: string
  particleCount?: number
  rangeY?: number
  baseHue?: number
  baseSpeed?: number
  rangeSpeed?: number
  baseRadius?: number
  rangeRadius?: number
  backgroundColor?: string
  rangeHue?: number
}

const props = withDefaults(defineProps<VortexProps>(), {
  containerClassName: '',
  className: '',
  particleCount: 700,
  rangeY: 100,
  baseHue: 220,
  baseSpeed: 0,
  rangeSpeed: 1.5,
  baseRadius: 1,
  rangeRadius: 2,
  backgroundColor: 'transparent',
  rangeHue: 60,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

const particlePropCount = 9
const baseTTL = 50
const rangeTTL = 150
const noiseSteps = 3
const xOff = 0.00125
const yOff = 0.00125
const zOff = 0.0005

let animationFrameId: number
let tick = 0
const noise3D = createNoise3D()
let particleProps = new Float32Array(props.particleCount * particlePropCount)
let center: [number, number] = [0, 0]

const HALF_PI = 0.5 * Math.PI
const TAU = 2 * Math.PI
const rand = (n: number) => n * Math.random()
const randRange = (n: number) => n - rand(2 * n)
const fadeInOut = (t: number, m: number) => {
  const hm = 0.5 * m
  return Math.abs(((t + hm) % m) - hm) / hm
}
const lerp = (n1: number, n2: number, speed: number) => (1 - speed) * n1 + speed * n2

function initParticle(i: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const x = rand(canvas.width)
  const y = center[1] + randRange(props.rangeY)
  const life = 0
  const ttl = baseTTL + rand(rangeTTL)
  const speed = props.baseSpeed + rand(props.rangeSpeed)
  const radius = props.baseRadius + rand(props.rangeRadius)
  const hue = props.baseHue + rand(props.rangeHue)
  particleProps.set([x, y, 0, 0, life, ttl, speed, radius, hue], i)
}

function initParticles() {
  tick = 0
  particleProps = new Float32Array(props.particleCount * particlePropCount)
  for (let i = 0; i < particleProps.length; i += particlePropCount) {
    initParticle(i)
  }
}

function drawParticle(
  x: number, y: number, x2: number, y2: number,
  life: number, ttl: number, radius: number, hue: number,
  ctx: CanvasRenderingContext2D,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = radius
  ctx.strokeStyle = `hsla(${hue}, 45%, 78%, ${fadeInOut(life, ttl)})`
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.closePath()
  ctx.restore()
}

function checkBounds(x: number, y: number, canvas: HTMLCanvasElement) {
  return x > canvas.width || x < 0 || y > canvas.height || y < 0
}

function updateParticle(i: number, ctx: CanvasRenderingContext2D) {
  const canvas = canvasRef.value
  if (!canvas) return
  const i2 = i + 1, i3 = i + 2, i4 = i + 3, i5 = i + 4, i6 = i + 5, i7 = i + 6, i8 = i + 7, i9 = i + 8
  const x = particleProps[i]
  const y = particleProps[i2]
  const n = noise3D(x * xOff, y * yOff, tick * zOff) * noiseSteps * TAU
  const vx = lerp(particleProps[i3], Math.cos(n), 0.5)
  const vy = lerp(particleProps[i4], Math.sin(n), 0.5)
  const life = particleProps[i5]
  const ttl = particleProps[i6]
  const speed = particleProps[i7]
  const x2 = x + vx * speed
  const y2 = y + vy * speed
  const radius = particleProps[i8]
  const hue = particleProps[i9]
  drawParticle(x, y, x2, y2, life, ttl, radius, hue, ctx)
  particleProps[i] = x2
  particleProps[i2] = y2
  particleProps[i3] = vx
  particleProps[i4] = vy
  particleProps[i5] = life + 1
  if (checkBounds(x, y, canvas) || life > ttl) initParticle(i)
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < particleProps.length; i += particlePropCount) {
    updateParticle(i, ctx)
  }
}

function renderGlow(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.filter = 'blur(6px) brightness(140%)'
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
  ctx.save()
  ctx.filter = 'blur(3px) brightness(140%)'
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
}

function renderToScreen(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
}

function resize(canvas: HTMLCanvasElement) {
  const container = containerRef.value
  if (!container) return
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  center[0] = 0.5 * canvas.width
  center[1] = 0.5 * canvas.height
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  tick++
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (props.backgroundColor !== 'transparent') {
    ctx.fillStyle = props.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  drawParticles(ctx)
  renderGlow(canvas, ctx)
  renderToScreen(canvas, ctx)
  animationFrameId = window.requestAnimationFrame(draw)
}

function handleResize() {
  const canvas = canvasRef.value
  if (canvas) resize(canvas)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  resize(canvas)
  initParticles()
  draw()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>
