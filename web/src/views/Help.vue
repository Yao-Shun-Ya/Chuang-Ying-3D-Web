<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-10">
      <h1 class="text-3xl font-bold tracking-tight">使用帮助</h1>
      <p class="text-muted-foreground mt-2">六步完成你的第一次 3D 打印</p>
    </div>

    <div class="relative pl-8 border-l border-border space-y-8">
      <div
        v-for="(item, i) in steps"
        :key="i"
        class="relative"
      >
        <span class="absolute -left-[41px] top-0 w-6 h-6 rounded-full gradient-bg text-white text-xs font-bold flex items-center justify-center ring-4 ring-background">
          {{ i + 1 }}
        </span>
        <div class="rounded-xl border border-border bg-card p-5 shadow-soft hover:shadow-lift transition-shadow">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-primary">{{ item.step }}</span>
          </div>
          <h3 class="text-lg font-semibold">{{ item.title }}</h3>
          <p class="text-sm text-muted-foreground mt-1 leading-relaxed">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
const steps = [
  { step: '第一步', title: '注册账号', desc: '点击右上角「注册」，填写用户名、密码及学号信息，完成注册并登录。' },
  { step: '第二步', title: '充值虚拟余额', desc: '在校内指定渠道购买 CDK 兑换码，进入「余额充值」页面输入 CDK 完成兑换，获得虚拟余额。' },
  { step: '第三步', title: '上传 3D 模型', desc: '进入「上传模型」页面，选择 STL / OBJ / 3MF 格式文件上传，系统自动解析体积并估算打印费用。' },
  { step: '第四步', title: '提交订单', desc: '确认费用后提交订单，系统自动扣减余额，订单进入待审核状态。' },
  { step: '第五步', title: '等待审核与打印', desc: '管理员审核模型合规性，通过后下发至打印设备执行打印，可在「我的订单」实时查看状态。' },
  { step: '第六步', title: '线下取件', desc: '订单状态变为「已完成」后，前往创意室凭订单号取件，确认后状态更新为「已取件」。' },
]
</script>
