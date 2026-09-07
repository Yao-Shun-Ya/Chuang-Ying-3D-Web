<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight">打印取件须知</h1>
      <p class="text-muted-foreground mt-2">请仔细阅读，确保顺利完成取件流程</p>
    </div>

    <!-- Notice banner -->
    <div class="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <p class="text-sm text-amber-800 leading-relaxed">
        请仔细阅读以下取件须知，确保顺利完成打印取件流程。
      </p>
    </div>

    <!-- Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div
        v-for="(item, i) in notices"
        :key="item.title"
        class="group rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300"
      >
        <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mb-4', item.bg]">
          <component :is="item.icon" class="w-6 h-6" :class="item.color" />
        </div>
        <h3 class="text-lg font-semibold mb-2">{{ item.title }}</h3>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ item.desc }}</p>
      </div>
    </div>

    <!-- Contact -->
    <div class="mt-10 rounded-2xl gradient-bg p-8 text-white shadow-lift relative overflow-hidden">
      <div class="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl"></div>
      <h3 class="relative text-xl font-bold mb-4 flex items-center gap-2">
        <Phone class="w-5 h-5" /> 创意室联系方式
      </h3>
      <div class="relative grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p class="text-white/70 mb-1">地点</p>
          <p class="font-medium">大学生活动中心 2 楼 创意室</p>
        </div>
        <div>
          <p class="text-white/70 mb-1">开放时间</p>
          <p class="font-medium">周一至周五 9:00 - 17:30</p>
        </div>
        <div>
          <p class="text-white/70 mb-1">联系电话</p>
          <p class="font-medium">0000-12345678</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { markRaw } from 'vue'
import { AlertTriangle, Ticket, Clock, MapPin, Phone, Headphones } from 'lucide-vue-next'

const notices = [
  { title: '取件凭证', desc: '取件时请提供订单号，可在「我的订单」页面查看。', icon: markRaw(Ticket), bg: 'bg-amber-100', color: 'text-amber-600' },
  { title: '取件时间', desc: '订单状态为「已完成」后即可取件，请于 7 日内领取。', icon: markRaw(Clock), bg: 'bg-sky-100', color: 'text-sky-600' },
  { title: '取件地点', desc: '大学生活动中心 2 楼创意室，工作时间内均可取件。', icon: markRaw(MapPin), bg: 'bg-emerald-100', color: 'text-emerald-600' },
  { title: '问题反馈', desc: '如模型质量有问题，请在取件时现场反馈工作人员。', icon: markRaw(Headphones), bg: 'bg-rose-100', color: 'text-rose-600' },
]
</script>
