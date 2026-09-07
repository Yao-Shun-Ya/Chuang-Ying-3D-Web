import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'
import gsap from 'gsap'

/**
 * 数字滚动动画
 */
export function useCountUp(target: Ref<HTMLElement | null>, end: number, duration = 1.6) {
  const value = ref(0)
  let obj = { val: 0 }

  function start() {
    obj = { val: 0 }
    gsap.to(obj, {
      val: end,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        value.value = obj.val
        if (target.value) target.value.textContent = Math.round(obj.val).toLocaleString()
      },
    })
  }

  return { value, start }
}

/**
 * 元素进场动画（挂载时）
 */
export function animateIn(el: HTMLElement, options: { delay?: number; y?: number } = {}) {
  const { delay = 0, y = 24 } = options
  gsap.fromTo(
    el,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration: 0.8, delay, ease: 'power3.out' },
  )
}
