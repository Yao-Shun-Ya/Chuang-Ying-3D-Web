<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight">常见问题</h1>
      <p class="text-muted-foreground mt-2">关于平台使用的常见疑问解答</p>
    </div>

    <div class="space-y-3">
      <div
        v-for="(q, i) in faqs"
        :key="i"
        class="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-soft"
      >
        <button
          class="w-full flex items-center justify-between p-5 text-left"
          @click="toggle(i)"
        >
          <span class="font-medium pr-4">{{ q.q }}</span>
          <ChevronDown
            class="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300"
            :class="{ 'rotate-180': active === i }"
          />
        </button>
        <div class="grid transition-all duration-300 ease-in-out" :class="active === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
          <div class="overflow-hidden">
            <p class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{{ q.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const active = ref<number | null>(0)

function toggle(i: number) {
  active.value = active.value === i ? null : i
}

const faqs = [
  { q: '支持哪些 3D 模型文件格式？', a: '目前支持 STL、OBJ、3MF 三种格式，单个文件大小不超过 50MB。' },
  { q: '打印费用是如何计算的？', a: '系统解析模型体积后，按 费用 = 体积 × 填充率 × 耗材密度 × 单价 计算。默认 PLA 耗材，密度 1.24 g/cm³，单价 0.5 元/g，填充率 20%。' },
  { q: '如何获得虚拟余额？', a: '在校内指定渠道购买 CDK 兑换码，在「余额充值」页面输入即可兑换。本平台不涉及真实资金收款。' },
  { q: 'CDK 可以重复使用吗？', a: '不可以。每个 CDK 码全局唯一，一旦兑换即标记为已使用，不可重复兑换。' },
  { q: '订单被驳回怎么办？', a: '若模型不符合打印要求（如尺寸超限、内容违规等），管理员会驳回订单并填写理由，费用将原路退回至账户余额。' },
  { q: '打印完成后如何取件？', a: '订单状态变为「已完成」后，凭订单号前往创意室取件，确认后管理员将状态更新为「已取件」。' },
  { q: '打印需要多长时间？', a: '打印时长取决于模型体积与复杂度，一般数小时至一天不等，可在订单详情中查看实时状态。' },
]
</script>
