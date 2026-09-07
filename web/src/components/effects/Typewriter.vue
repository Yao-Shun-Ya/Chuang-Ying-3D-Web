<template>
  <span class="inline-flex items-center min-h-[1.2em] align-middle">
    <span>{{ displayText }}</span>
    <span class="cursor-wrap" :class="{ 'is-hidden': !cursorVisible }">
      <span class="cursor-trail"></span>
      <span class="cursor"></span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  words: string[]
  typeSpeed?: number
  deleteSpeed?: number
  pauseTime?: number
}>(), {
  typeSpeed: 120,
  deleteSpeed: 60,
  pauseTime: 1500,
})

const displayText = ref('')
const cursorVisible = ref(true)
let wordIndex = 0
let charIndex = 0
let isDeleting = false
let timer: number
let cursorTimer: number

function tick() {
  const currentWord = props.words[wordIndex]

  if (!isDeleting) {
    charIndex++
    displayText.value = currentWord.slice(0, charIndex)
    if (charIndex === currentWord.length) {
      isDeleting = true
      timer = window.setTimeout(tick, props.pauseTime)
      return
    }
    timer = window.setTimeout(tick, props.typeSpeed)
  } else {
    charIndex--
    displayText.value = currentWord.slice(0, charIndex)
    if (charIndex === 0) {
      isDeleting = false
      wordIndex = (wordIndex + 1) % props.words.length
      timer = window.setTimeout(tick, props.typeSpeed)
      return
    }
    timer = window.setTimeout(tick, props.deleteSpeed)
  }
}

onMounted(() => {
  tick()
  cursorTimer = window.setInterval(() => {
    cursorVisible.value = !cursorVisible.value
  }, 500)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (cursorTimer) clearInterval(cursorTimer)
})
</script>

<style scoped>
.cursor-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 3px;
  height: 1.15em;
  transition: opacity 0.12s ease;
}
.cursor-wrap.is-hidden {
  opacity: 0;
}

/* 光标本体：浅色渐变竖条 */
.cursor {
  display: block;
  width: 3px;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(
    180deg,
    rgba(224, 231, 255, 0.95) 0%,
    rgba(196, 181, 253, 0.9) 50%,
    rgba(165, 180, 252, 0.85) 100%
  );
  box-shadow:
    0 0 4px rgba(196, 181, 253, 0.9),
    0 0 10px rgba(165, 180, 252, 0.6),
    0 0 20px rgba(165, 180, 252, 0.35),
    0 0 32px rgba(165, 180, 252, 0.2);
  animation: cursor-breathe 1.6s ease-in-out infinite;
}

/* 拖影：光标左侧渐隐光带 */
.cursor-trail {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 70%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(196, 181, 253, 0.15) 30%,
    rgba(196, 181, 253, 0.45) 70%,
    rgba(224, 231, 255, 0.7) 100%
  );
  filter: blur(3px);
  pointer-events: none;
  animation: trail-fade 1.6s ease-in-out infinite;
}

@keyframes cursor-breathe {
  0%, 100% {
    filter: brightness(1);
    box-shadow:
      0 0 4px rgba(196, 181, 253, 0.9),
      0 0 10px rgba(165, 180, 252, 0.6),
      0 0 20px rgba(165, 180, 252, 0.35),
      0 0 32px rgba(165, 180, 252, 0.2);
  }
  50% {
    filter: brightness(1.25);
    box-shadow:
      0 0 6px rgba(196, 181, 253, 1),
      0 0 14px rgba(165, 180, 252, 0.8),
      0 0 26px rgba(165, 180, 252, 0.5),
      0 0 40px rgba(165, 180, 252, 0.3);
  }
}

@keyframes trail-fade {
  0%, 100% { opacity: 0.5; width: 22px; }
  50% { opacity: 0.85; width: 30px; }
}
</style>
