<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  duration?: number
}>(), {
  duration: 0,
})

const isMobile = ref(false)
const svgEl = ref<SVGSVGElement | null>(null)

// 唯一化 id
const uid = Math.random().toString(36).slice(2, 8)
const idColor = `tc-${uid}`   // 彩色径向渐变
const idMask = `tm-${uid}`    // mask
const idMaskGrad = `mg-${uid}` // mask 用的径向渐变（白→黑）

const words = props.text.split(' ')

function onResize() {
  isMobile.value = window.innerWidth < 1024
}

function handleMouseMove(e: MouseEvent) {
  const svg = svgEl.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const inside =
    e.clientX >= rect.left && e.clientX <= rect.right &&
    e.clientY >= rect.top && e.clientY <= rect.bottom

  const texts = svg.querySelectorAll('text')

  if (inside) {
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top) / rect.height
    // 更新两个径向渐变的中心
    const colorGrad = svg.querySelector(`#${idColor}`) as SVGRadialGradientElement | null
    const maskGrad = svg.querySelector(`#${idMaskGrad}`) as SVGRadialGradientElement | null
    if (colorGrad) {
      colorGrad.setAttribute('cx', String(cx))
      colorGrad.setAttribute('cy', String(cy))
    }
    if (maskGrad) {
      maskGrad.setAttribute('cx', String(cx))
      maskGrad.setAttribute('cy', String(cy))
    }
    texts.forEach((t) => {
      const hasMask = t.hasAttribute('mask')
      t.style.opacity = hasMask ? '1' : '0.8'
    })
  } else {
    texts.forEach((t) => {
      const hasMask = t.hasAttribute('mask')
      t.style.opacity = hasMask ? '0' : '0.25'
    })
  }
}

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', handleMouseMove)
  const svg = svgEl.value
  if (svg) {
    svg.querySelectorAll('text').forEach((t) => {
      const hasMask = t.hasAttribute('mask')
      t.style.opacity = hasMask ? '0' : '0.25'
    })
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <svg
    ref="svgEl"
    class="text-hover-svg w-full h-full select-none pointer-events-none"
    :viewBox="isMobile ? '0 0 800 200' : '0 0 1600 100'"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <!-- 彩色径向渐变：中心向外发散（低饱和柔和） -->
      <radialGradient
        :id="idColor"
        gradientUnits="objectBoundingBox"
        cx="0.5"
        cy="0.5"
        r="0.6"
      >
        <stop offset="0%" stop-color="#818cf8" />
        <stop offset="30%" stop-color="#a78bfa" />
        <stop offset="55%" stop-color="#b794f4" />
        <stop offset="80%" stop-color="#a5b4fc" />
        <stop offset="100%" stop-color="#c4b5fd" />
      </radialGradient>

      <!-- mask 用径向渐变：中心白（显示），外围黑（隐藏） -->
      <radialGradient
        :id="idMaskGrad"
        gradientUnits="objectBoundingBox"
        cx="0.5"
        cy="0.5"
        r="0.35"
      >
        <stop offset="0%" stop-color="white" />
        <stop offset="70%" stop-color="white" />
        <stop offset="100%" stop-color="black" />
      </radialGradient>

      <mask :id="idMask">
        <rect x="0" y="0" width="100%" height="100%" :fill="`url(#${idMaskGrad})`" />
      </mask>
    </defs>

    <g>
      <template v-if="isMobile">
        <template v-for="(word, i) in words" :key="i">
          <text
            x="50%" :y="`${35 + i * 40}%`" text-anchor="middle" dominant-baseline="middle"
            stroke-width="1" font-size="80"
            class="fill-transparent stroke-slate-400 font-sans font-black"
            style="opacity: 0; transition: opacity 0.2s"
          >{{ word }}</text>
          <text
            x="50%" :y="`${35 + i * 40}%`" text-anchor="middle" dominant-baseline="middle"
            :stroke="`url(#${idColor})`" stroke-width="1" font-size="80"
            :mask="`url(#${idMask})`" class="fill-transparent font-sans font-black"
            style="opacity: 0; transition: opacity 0.2s"
          >{{ word }}</text>
        </template>
      </template>
      <template v-else>
        <text
          x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
          stroke-width="0.8" font-size="70"
          class="fill-transparent stroke-slate-400 font-sans font-black"
          style="opacity: 0; transition: opacity 0.2s"
        >{{ text }}</text>
        <text
          x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
          :stroke="`url(#${idColor})`" stroke-width="0.8" font-size="70"
          :mask="`url(#${idMask})`" class="fill-transparent font-sans font-black"
          style="opacity: 0; transition: opacity 0.2s"
        >{{ text }}</text>
      </template>
    </g>
  </svg>
</template>
