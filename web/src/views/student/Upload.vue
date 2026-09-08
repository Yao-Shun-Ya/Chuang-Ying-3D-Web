<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">上传模型</h1>
      <p class="text-muted-foreground mt-1">上传 STL / OBJ / 3MF 文件，系统自动解析体积并计价</p>
    </div>

    <div class="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div class="p-8">
        <!-- Drop zone -->
        <div
          class="relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300"
          :class="dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'"
          @click="$refs.fileInput?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept=".stl,.obj,.3mf" class="hidden" @change="onFileSelect" />
          <div class="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <UploadCloud class="w-8 h-8 text-primary" />
          </div>
          <p class="text-base font-medium">
            将文件拖到此处，或<span class="text-primary">点击上传</span>
          </p>
          <p class="text-sm text-muted-foreground mt-2">支持 STL / OBJ / 3MF 格式，单文件不超过 50MB</p>
        </div>

        <!-- Parsing result -->
        <Transition name="fade">
          <div v-if="result" class="mt-8">
            <div class="flex items-center gap-2 mb-4">
              <CheckCircle2 class="w-5 h-5 text-emerald-500" />
              <h3 class="text-lg font-semibold">解析结果</h3>
            </div>

            <!-- 3D 模型预览 -->
            <div class="mb-6">
              <ModelViewer :model-url="modelFileUrl" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="rounded-xl border border-border bg-secondary/30 p-4">
                <p class="text-xs text-muted-foreground mb-1">文件名</p>
                <p class="font-medium truncate">{{ result.originalName }}</p>
              </div>
              <div class="rounded-xl border border-border bg-secondary/30 p-4">
                <p class="text-xs text-muted-foreground mb-1">格式</p>
                <p class="font-medium uppercase">{{ result.format }}</p>
              </div>
              <div class="rounded-xl border border-border bg-secondary/30 p-4">
                <p class="text-xs text-muted-foreground mb-1">文件大小</p>
                <p class="font-medium">{{ formatSize(result.fileSize) }}</p>
              </div>
              <div class="rounded-xl border border-border bg-secondary/30 p-4">
                <p class="text-xs text-muted-foreground mb-1">模型体积</p>
                <p class="font-medium">{{ scaledVolume }} cm³</p>
              </div>
            </div>

            <!-- 缩放倍数 -->
            <div class="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">缩放倍数</span>
                <span class="text-sm text-primary font-semibold">{{ scale.toFixed(2) }}x</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  v-model.number="scale"
                  class="flex-1 accent-indigo-500"
                />
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  v-model.number="scale"
                  class="w-20 px-2 py-1 text-sm border border-border rounded bg-background"
                />
              </div>
              <p class="text-xs text-muted-foreground mt-2">体积与费用按倍数的立方计算（×{{ scaleCubed.toFixed(2) }}）</p>
            </div>

            <div class="mt-4 rounded-xl gradient-bg p-6 text-white flex items-center justify-between">
              <div>
                <p class="text-sm text-white/80">预估费用</p>
                <p class="text-4xl font-bold mt-1">¥{{ scaledCost }}</p>
              </div>
              <Button
                variant="secondary"
                size="lg"
                class="bg-white text-primary hover:bg-white/90"
                :disabled="submitting"
                @click="submitOrder"
              >
                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
                {{ submitting ? '提交中...' : `确认下单（扣费 ¥${scaledCost}）` }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { uploadModel, createOrder } from '@/api'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import { useDraft } from '@/composables/useDraft'
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import ModelViewer from '@/components/ModelViewer.vue'

const router = useRouter()
const userStore = useUserStore()
const fileInput = ref<HTMLInputElement>()
const result = ref<any>(null)
const submitting = ref(false)
const dragging = ref(false)

// 草稿数据：缩放倍数 + 模型解析结果摘要
const draft = reactive({
  scale: 1,
  modelId: null as number | null,
  modelInfo: null as any,
})

// 自动保存草稿到 localStorage
const { clear: clearDraft, restored } = useDraft('upload-form', draft)

// 页面挂载后，若有草稿则恢复模型解析结果
onMounted(() => {
  if (draft.modelInfo && draft.modelId) {
    result.value = { id: draft.modelId, ...draft.modelInfo }
    toast.info('已恢复上次未提交的表单')
  }
})

const scale = computed({
  get: () => draft.scale,
  set: (v) => { draft.scale = v },
})

const modelFileUrl = computed(() => {
  if (!result.value?.id) return ''
  return `/api/models/${result.value.id}/file`
})

const scaleCubed = computed(() => scale.value * scale.value * scale.value)
const scaledVolume = computed(() => {
  if (!result.value) return '0'
  return (+(result.value.volume * scaleCubed.value)).toFixed(4)
})
const scaledCost = computed(() => {
  if (!result.value) return '0.00'
  return (+(result.value.estimatedCost * scaleCubed.value)).toFixed(2)
})

function validate(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['stl', 'obj', '3mf'].includes(ext || '')) {
    toast.error('仅支持 STL / OBJ / 3MF 格式')
    return false
  }
  if (file.size > 50 * 1024 * 1024) {
    toast.error('文件大小不能超过 50MB')
    return false
  }
  return true
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) upload(file)
}

function onFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) upload(file)
}

async function upload(file: File) {
  if (!validate(file)) return
  try {
    const res = await uploadModel(file)
    result.value = res
    draft.scale = 1
    draft.modelId = res.id
    draft.modelInfo = {
      originalName: res.originalName,
      format: res.format,
      fileSize: res.fileSize,
      volume: res.volume,
      estimatedCost: res.estimatedCost,
    }
    toast.success('模型解析成功')
  } catch {
    // error handled by interceptor
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

async function submitOrder() {
  submitting.value = true
  try {
    const order = await createOrder(result.value.id, undefined, scale.value)
    toast.success(`订单已提交，订单号：${order.order_no}`)
    userStore.setBalance(userStore.user!.balance - Number(scaledCost.value))
    clearDraft() // 下单成功后清除草稿
    router.push('/orders')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
