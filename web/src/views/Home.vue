<template>
  <div>
    <!-- Hero with 3D background -->
    <section class="relative min-h-[92vh] flex items-center overflow-hidden">
      <div class="absolute inset-0 z-0 opacity-60">
        <WavyBackground />
      </div>
      <ThreeScene />
      <!-- gradient overlays for readability -->
      <div class="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background pointer-events-none"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-background/60 via-background/20 to-transparent pointer-events-none"></div>

      <div class="relative max-w-7xl mx-auto px-6 w-full">
        <div class="max-w-2xl">
          <div v-reveal class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/70 bg-card/60 glass mb-6">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-xs font-medium text-muted-foreground">校内封闭式 · 创意室出品</span>
          </div>

          <h1 v-reveal="{ delay: 0.1 }" class="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-balance">
            让创意<br />
            <span class="gradient-text">触手可及</span>
          </h1>

          <div v-reveal="{ delay: 0.15 }" class="mt-4 h-12 md:h-16">
            <TextHoverEffect text="创影3D · 造物无界" variant="all" />
          </div>

          <p v-reveal="{ delay: 0.2 }" class="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
            上传 STL / OBJ / 3MF 模型，系统自动解析体积并估算打印费用，在线下单，实时跟踪进度。
          </p>

          <div v-reveal="{ delay: 0.3 }" class="mt-8 flex flex-wrap gap-4">
            <Button v-if="userStore.isLoggedIn && !userStore.isAdmin" variant="gradient" size="lg" @click="$router.push('/upload')">
              <Upload class="w-5 h-5" /> 立即上传模型
            </Button>
            <Button v-else-if="!userStore.isLoggedIn" variant="gradient" size="lg" @click="$router.push('/register')">
              注册账号 <ArrowRight class="w-5 h-5" />
            </Button>
            <Button variant="outline" size="lg" @click="$router.push('/help')">
              使用帮助
            </Button>
          </div>

          <!-- mini stats -->
          <div v-reveal="{ delay: 0.4 }" class="mt-12 grid grid-cols-3 gap-6 max-w-lg">
            <div v-for="s in stats" :key="s.label">
              <div class="text-3xl font-bold gradient-text min-h-[2.5rem] flex items-center">
                <Typewriter v-if="s.typewriter" :words="s.formats" />
                <span v-else>{{ s.value }}</span>
              </div>
              <div class="text-sm text-muted-foreground mt-1">{{ s.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- scroll hint -->
      <Transition name="fade">
        <div v-show="!scrolled" class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground">
          <span class="text-xs">向下滚动</span>
          <div class="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div class="w-1 h-2 rounded-full bg-muted-foreground/50 animate-bounce"></div>
          </div>
        </div>
      </Transition>
    </section>

    <!-- Steps -->
    <section class="max-w-7xl mx-auto px-6 py-24">
      <div v-reveal class="text-center mb-14">
        <h2 class="text-4xl font-bold tracking-tight">使用流程</h2>
        <p class="mt-3 text-muted-foreground">四步完成你的 3D 打印</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <RevealCard
          v-for="(s, i) in steps"
          :key="i"
          v-reveal="{ delay: i * 0.1 }"
          :colors="[[165, 180, 252], [196, 181, 253]]"
          class="p-6"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white font-bold shadow-lift">
              {{ i + 1 }}
            </div>
            <component :is="s.icon" class="w-5 h-5 text-primary" />
          </div>
          <h3 class="text-lg font-semibold mb-1.5">{{ s.title }}</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">{{ s.desc }}</p>
        </RevealCard>
      </div>
    </section>

    <!-- Features -->
    <section class="relative bg-secondary/40 border-y border-border overflow-hidden">
      <div class="absolute inset-0 opacity-40 pointer-events-none">
        <Sparkles :particle-color="'#8b5cf6'" :particle-density="80" :min-size="1" :max-size="2" />
      </div>
      <div class="relative max-w-7xl mx-auto px-6 py-24">
        <div v-reveal class="text-center mb-14">
          <h2 class="text-4xl font-bold tracking-tight">平台特点</h2>
          <p class="mt-3 text-muted-foreground">为校内创客量身打造</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RevealCard
            v-for="(f, i) in features"
            :key="f.title"
            v-reveal="{ delay: i * 0.1 }"
            :colors="[[196, 181, 253], [233, 213, 255]]"
            class="p-8"
          >
            <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <component :is="f.icon" class="w-7 h-7 text-primary" />
            </div>
            <h3 class="text-xl font-semibold mb-2">{{ f.title }}</h3>
            <p class="text-muted-foreground leading-relaxed">{{ f.desc }}</p>
          </RevealCard>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-7xl mx-auto px-6 py-24">
      <div v-reveal class="relative overflow-hidden rounded-3xl shadow-lift" style="height: 480px;">
        <!-- 渐变背景层（最底层） -->
        <div class="absolute inset-0 gradient-bg rounded-3xl"></div>
        <div class="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
        <div class="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
        <!-- 漩涡粒子层 -->
        <Vortex
          backgroundColor="transparent"
          :particleCount="500"
          :rangeY="280"
          :baseHue="230"
          :rangeHue="50"
          :baseSpeed="0.15"
          :rangeSpeed="1.5"
          :baseRadius="1"
          :rangeRadius="2"
          containerClassName="absolute inset-0 rounded-3xl"
          className="flex items-center flex-col justify-center px-8 w-full h-full"
        >
          <h2 class="relative text-4xl font-bold mb-4 text-white">准备好开始造物了吗？</h2>
          <p class="relative text-white/80 text-lg mb-8 max-w-xl mx-auto text-center">
            注册账号，充值 CDK，立即体验一站式 3D 打印服务。
          </p>
          <Button variant="secondary" size="lg" class="bg-white text-primary hover:bg-white/90 relative" @click="$router.push(userStore.isLoggedIn ? '/upload' : '/register')">
            {{ userStore.isLoggedIn ? '上传模型' : '立即注册' }} <ArrowRight class="w-5 h-5" />
          </Button>
        </Vortex>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import ThreeScene from '@/components/ThreeScene.vue'
import WavyBackground from '@/components/effects/WavyBackground.vue'
import TextHoverEffect from '@/components/effects/TextHoverEffect.vue'
import Sparkles from '@/components/effects/Sparkles.vue'
import RevealCard from '@/components/effects/RevealCard.vue'
import Vortex from '@/components/effects/Vortex.vue'
import Typewriter from '@/components/effects/Typewriter.vue'
import Button from '@/components/ui/Button.vue'
import { Upload, ArrowRight, User, Wallet, FileBox, CheckCircle, Calculator, Ticket, Bell } from 'lucide-vue-next'
import { markRaw, ref, onMounted, onUnmounted } from 'vue'

const userStore = useUserStore()
const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 80
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const stats = [
  { value: '4+', label: '打印流程' },
  { label: '支持格式', typewriter: true, formats: ['STL', 'OBJ', '3MF', 'PLY', 'AMF'] },
  { value: '24h', label: '审核响应' },
]

const steps = [
  { title: '注册登录', desc: '使用学号信息注册账号并登录平台', icon: markRaw(User) },
  { title: '充值余额', desc: '购买 CDK 兑换码，充值虚拟余额', icon: markRaw(Wallet) },
  { title: '上传下单', desc: '上传模型，系统自动计算打印费用', icon: markRaw(FileBox) },
  { title: '审核取件', desc: '管理员审核后打印，完成后取件', icon: markRaw(CheckCircle) },
]

const features = [
  { title: '自动计价', desc: '解析模型体积，结合耗材参数自动估算打印费用', icon: markRaw(Calculator) },
  { title: 'CDK 充值', desc: '不涉及真实资金，使用 CDK 兑换码完成虚拟余额充值', icon: markRaw(Ticket) },
  { title: '实时跟踪', desc: '订单状态实时推送，随时掌握打印进度', icon: markRaw(Bell) },
]
</script>
