<template>
  <Dialog v-model="visible">
    <div class="space-y-5 max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-bold flex items-center gap-2">
          <Plus class="w-5 h-5 text-primary" /> 新增设备
        </h3>
        <button class="text-muted-foreground hover:text-foreground" @click="close">
          <X class="w-4 h-4" />
        </button>
      </div>

      <ListSkeleton v-if="loading" :columns="2" :rows="3" />

      <template v-else>
        <!-- 品牌 -->
        <div class="space-y-1.5">
          <Label>设备品牌</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="b in brands" :key="b.type"
              @click="pickBrand(b.type)"
              :class="[
                'rounded-xl border p-3 text-left transition-all',
                selectedType === b.type ? 'border-primary bg-primary/5 shadow-soft' : 'border-border hover:border-primary/40',
              ]"
            >
              <p class="text-sm font-medium">{{ b.brand }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ categoryLabel(b.category) }}</p>
            </button>
          </div>
        </div>

        <!-- 型号 -->
        <div v-if="currentBrand" class="space-y-1.5">
          <Label>设备型号</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="m in currentBrand.models" :key="m.model"
              @click="pickModel(m.model)"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                model === m.model ? 'gradient-bg text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
              ]"
            >
              {{ m.model }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground">协议：{{ currentBrand.protocol }}</p>
        </div>

        <!-- 连接参数 -->
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>设备ID（留空自动生成）</Label>
            <Input v-model="form.id" placeholder="如：bambu-03" />
          </div>
          <div class="space-y-1.5">
            <Label>设备名称</Label>
            <Input v-model="form.name" :placeholder="`${model || selectedType} · 新设备`" />
          </div>
          <div class="space-y-1.5">
            <Label>设备 IP / 主机 <span class="text-red-500">*</span></Label>
            <Input v-model="form.host" placeholder="192.168.1.xx" />
          </div>

          <template v-if="field('serial').show">
            <div class="space-y-1.5">
              <Label>{{ field('serial').label }}</Label>
              <Input v-model="form.serial" :placeholder="field('serial').placeholder" />
            </div>
          </template>
          <template v-if="field('accessCode').show">
            <div class="space-y-1.5">
              <Label>{{ field('accessCode').label }}</Label>
              <Input v-model="form.accessCode" :placeholder="field('accessCode').placeholder" />
            </div>
          </template>
          <template v-if="field('mqttPort').show">
            <div class="space-y-1.5">
              <Label>MQTT 端口</Label>
              <Input v-model="form.mqttPort" type="number" placeholder="8883" />
            </div>
          </template>
          <template v-if="field('wsPort').show">
            <div class="space-y-1.5">
              <Label>WebSocket 端口</Label>
              <Input v-model="form.wsPort" type="number" :placeholder="field('wsPort').placeholder" />
            </div>
          </template>
          <template v-if="field('restPort').show">
            <div class="space-y-1.5">
              <Label>REST 端口</Label>
              <Input v-model="form.restPort" type="number" placeholder="8080" />
            </div>
          </template>
          <template v-if="field('probePort').show">
            <div class="space-y-1.5">
              <Label>探活端口</Label>
              <Input v-model="form.probePort" type="number" placeholder="9900" />
            </div>
          </template>
          <div class="space-y-1.5">
            <Label>备注</Label>
            <Input v-model="form.description" placeholder="选填，设备位置 / 用途等" />
          </div>
        </div>

        <!-- 能力预览 -->
        <div v-if="currentBrand" class="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
          支持操作：
          <span v-for="c in currentBrand.supports" :key="c" class="inline-block mr-1.5 mt-1 px-1.5 py-0.5 rounded bg-background border border-border">
            {{ cmdLabel(c) }}
          </span>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="outline" @click="close">取消</Button>
          <Button variant="gradient" :disabled="!form.host || saving" @click="save">
            <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
            {{ saving ? '添加中...' : '添加并接入' }}
          </Button>
        </div>
        <p v-if="saveResult" :class="['text-xs', saveResult.ok ? 'text-emerald-600' : 'text-red-500']">
          {{ saveResult.msg }}
        </p>
      </template>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import ListSkeleton from '@/components/ui/ListSkeleton.vue'
import { getDeviceRegistry, addDevice } from '@/api'
import { toast } from '@/composables/useToast'
import { Plus, X, Loader2 } from 'lucide-vue-next'

interface RegistryBrand {
  type: string
  brand: string
  category: string
  protocol: string
  paramsTemplate: Record<string, unknown>
  supports: string[]
  models: { model: string }[]
}

const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const brands = ref<RegistryBrand[]>([])
const selectedType = ref('')
const model = ref('')
const saveResult = ref<{ ok: boolean; msg: string } | null>(null)

const form = ref<Record<string, string>>({ id: '', name: '', host: '', serial: '', accessCode: '', mqttPort: '', wsPort: '', restPort: '', probePort: '', description: '' })

const currentBrand = computed(() => brands.value.find((b) => b.type === selectedType.value) || null)

function field(key: string) {
  const meta = currentBrand.value?.paramsTemplate || {}
  const map: Record<string, { show: boolean; label?: string; placeholder?: string }> = {
    serial: { show: 'serial' in meta || selectedType.value === 'bambu', label: '序列号', placeholder: '如 01S00C000000001' },
    accessCode: { show: 'accessCode' in meta || selectedType.value === 'bambu', label: '访问码', placeholder: '8 位访问码' },
    mqttPort: { show: selectedType.value === 'bambu', label: 'MQTT 端口', placeholder: '8883' },
    wsPort: { show: 'wsPort' in meta, label: 'WebSocket 端口', placeholder: selectedType.value === 'xtool' ? '28900' : '9999' },
    restPort: { show: 'restPort' in meta, label: 'REST 端口', placeholder: '8080' },
    probePort: { show: selectedType.value === 'eufymake', label: '探活端口', placeholder: '9900' },
  }
  return map[key]
}

function categoryLabel(c: string) {
  return c === 'fdm' ? '3D 打印机' : c === 'laser' ? '激光设备' : 'UV 打印机'
}

function cmdLabel(c: string) {
  const m: Record<string, string> = { pause: '暂停', resume: '恢复', stop: '停止', led_on: '灯光', led_off: '灯光', pushall: '刷新' }
  return m[c] || c
}

function pickBrand(type: string) {
  selectedType.value = type
  model.value = ''
  // 清空并套用默认端口
  resetPorts()
}

function pickModel(m: string) {
  model.value = m
  const b = currentBrand.value
  if (b) {
    const t = b.paramsTemplate || {}
    // 自动带出默认端口
    if (t.mqttPort) form.value.mqttPort = String(t.mqttPort)
    if (t.wsPort) form.value.wsPort = String(t.wsPort)
    if (t.restPort) form.value.restPort = String(t.restPort)
    if (t.probePort) form.value.probePort = String(t.probePort)
    // 自动带出序列号/访问码（若模板提供占位）
    if (t.serial && typeof t.serial === 'string' && !form.value.serial) form.value.serial = String(t.serial)
    if (t.accessCode && typeof t.accessCode === 'string' && !form.value.accessCode) form.value.accessCode = String(t.accessCode)
  }
}

function resetPorts() {
  form.value.mqttPort = ''
  form.value.wsPort = ''
  form.value.restPort = ''
  form.value.probePort = ''
  form.value.serial = ''
  form.value.accessCode = ''
}

async function open() {
  visible.value = true
  saveResult.value = null
  loading.value = true
  try {
    brands.value = await getDeviceRegistry() as any
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
  selectedType.value = ''
  model.value = ''
  Object.assign(form.value, { id: '', name: '', host: '', serial: '', accessCode: '', mqttPort: '', wsPort: '', restPort: '', probePort: '', description: '' })
}

async function save() {
  if (!form.value.host) {
    toast.warning('请填写设备 IP')
    return
  }
  saving.value = true
  saveResult.value = null
  const num = (v: string | undefined) => (v ? Number(v) : undefined)
  try {
    await addDevice({
      id: form.value.id.trim() || undefined,
      name: form.value.name.trim() || undefined,
      type: selectedType.value,
      category: brands.value.find((b) => b.type === selectedType.value)?.category as any,
      model: model.value || undefined,
      host: form.value.host.trim(),
      serial: form.value.serial?.trim() || undefined,
      accessCode: form.value.accessCode?.trim() || undefined,
      mqttPort: num(form.value.mqttPort),
      wsPort: num(form.value.wsPort),
      restPort: num(form.value.restPort),
      probePort: num(form.value.probePort),
      description: form.value.description?.trim() || undefined,
    })
    toast.success('设备已添加并接入')
    visible.value = false
    emit('saved')
  } catch (e: any) {
    saveResult.value = { ok: false, msg: (e?.response?.data?.msg) || e?.message || '添加失败' }
  } finally {
    saving.value = false
  }
}

const emit = defineEmits<{ (e: 'saved'): void }>()
defineExpose({ open })
</script>