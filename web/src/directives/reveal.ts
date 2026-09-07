import type { Directive } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * v-reveal 指令：滚动到视口时元素进场
 * 用法：v-reveal 或 v-reveal="{ delay: 0.2, y: 30 }"
 */
export const vReveal: Directive<HTMLElement, { delay?: number; y?: number } | undefined> = {
  mounted(el, binding) {
    const delay = binding.value?.delay ?? 0
    const y = binding.value?.y ?? 30

    gsap.set(el, { opacity: 0, y })

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay,
          ease: 'power3.out',
        })
      },
    })
  },
  unmounted(el) {
    ScrollTrigger.getAll().forEach((t) => {
      if (t.trigger === el) t.kill()
    })
  },
}
