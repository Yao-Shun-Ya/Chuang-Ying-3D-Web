<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
    <AmbientBackground />
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">账号管理</h1>
      <p class="text-muted-foreground mt-1">管理你的个人资料、安全设置与账户余额</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 头像 & 展示名 -->
      <div class="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div class="text-center">
          <div class="relative inline-block">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              class="w-28 h-28 rounded-full object-cover ring-4 ring-primary/10"
              alt="avatar"
            />
            <div v-else class="w-28 h-28 rounded-full gradient-bg flex items-center justify-center text-white text-3xl font-bold ring-4 ring-primary/10">
              {{ displayInitial }}
            </div>
          </div>
          <div class="mt-3 text-lg font-semibold">{{ defaultDisplayName }}</div>
          <div class="text-sm text-muted-foreground">{{ user?.email }}</div>

          <div class="mt-5 space-y-3">
            <Button variant="outline" size="sm" class="w-full" @click="fileInput?.click()">
              <Upload class="w-4 h-4 mr-1.5" /> 更换头像
            </Button>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePick" />
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-border space-y-3">
          <div class="space-y-1.5">
            <Label>展示名称</Label>
            <div class="flex gap-2">
              <Input v-model="displayNameInput" placeholder="展示名称" />
              <Button variant="gradient" :disabled="savingName" @click="saveDisplayName">
                <Check v-if="savingName" class="w-4 h-4 animate-pulse" />
                保存
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">默认名称为邮箱前缀，可在此修改</p>
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-border">
          <h4 class="font-medium mb-3 text-sm">个人信息</h4>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-muted-foreground">邮箱</dt><dd>{{ user?.email }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">真实姓名</dt><dd>{{ user?.realName || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted-foreground">学号</dt><dd>{{ user?.studentNo || '-' }}</dd></div>
          </dl>
          <Button variant="outline" size="sm" class="w-full mt-4" @click="openInfoDialog">
            <Pencil class="w-4 h-4 mr-1.5" /> 修改个人信息
          </Button>
        </div>
      </div>

      <!-- 右侧：余额 + 改密 -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 余额卡 -->
        <div class="relative overflow-hidden rounded-2xl gradient-bg p-7 text-white shadow-lift">
          <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
          <div class="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10 blur-2xl"></div>
          <div class="relative flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2 text-white/80 text-sm mb-2">
                <Wallet class="w-4 h-4" /> 当前余额
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-xl">¥</span>
                <span class="text-5xl font-bold tracking-tight">{{ balance.toFixed(2) }}</span>
              </div>
            </div>
            <div class="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Ticket class="w-8 h-8" />
            </div>
          </div>
          <div class="relative mt-6 flex gap-3">
            <Input
              v-model="cdkCode"
              placeholder="输入 CDK 兑换码充值"
              class="bg-white/15 border-white/20 text-white placeholder:text-white/60"
              @keyup.enter="redeem"
            />
            <Button variant="secondary" :disabled="redeeming || !cdkCode.trim()" @click="redeem">
              <Loader2 v-if="redeeming" class="w-4 h-4 animate-spin" /> 兑换
            </Button>
          </div>
        </div>

        <!-- 修改密码 -->
        <div class="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div class="flex items-center gap-2 mb-5">
            <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock class="w-5 h-5 text-primary" />
            </div>
            <h3 class="text-lg font-semibold">修改密码</h3>
          </div>
          <div class="space-y-4">
            <div class="space-y-2">
              <Label>邮箱验证码 <span class="text-xs text-muted-foreground">(发送至 {{ user?.email }})</span></Label>
              <div class="flex gap-3">
                <Input v-model="pwForm.code" placeholder="6 位验证码" class="flex-1" />
                <Button type="button" variant="outline" :disabled="codeCountdown > 0 || sendingCode" @click="sendPwCode">
                  <Loader2 v-if="sendingCode" class="w-4 h-4 animate-spin mr-1" />
                  {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码' }}
                </Button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>新密码</Label>
                <Input v-model="pwForm.newPassword" type="password" placeholder="至少 6 位" />
              </div>
              <div class="space-y-2">
                <Label>确认新密码</Label>
                <Input v-model="pwForm.confirmPassword" type="password" placeholder="再次输入新密码" />
              </div>
            </div>
          </div>
          <div class="mt-5">
            <Button variant="gradient" :disabled="changingPw" @click="changePw">
              <Loader2 v-if="changingPw" class="w-4 h-4 animate-spin" /> {{ changingPw ? '提交中' : '更新密码' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 头像裁切弹窗 -->
    <Teleport to="body">
      <div v-if="cropping" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden">
          <div class="p-5 border-b border-border">
            <h3 class="text-lg font-semibold">裁切头像</h3>
            <p class="text-sm text-muted-foreground mt-1">拖动图片调整位置，滚轮或下方滑块缩放，最终输出为 400×400</p>
          </div>
          <div class="p-5">
            <div
              ref="cropStage"
              class="relative w-full aspect-square bg-muted rounded-xl overflow-hidden select-none touch-none"
              @mousedown="startDrag"
              @touchstart.passive="startDrag"
              @wheel.prevent="onWheel"
            >
              <img
                ref="cropImg"
                :src="cropSrc"
                class="absolute left-0 top-0 max-w-none pointer-events-none"
                :style="imgStyle"
                draggable="false"
              />
              <div class="absolute inset-0 pointer-events-none">
                <div class="absolute inset-0 border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] rounded-lg"></div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-3">
              <ZoomOut class="w-4 h-4 text-muted-foreground" />
              <input type="range" min="1" max="4" step="0.01" v-model.number="zoom" class="flex-1" />
              <ZoomIn class="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div class="p-5 border-t border-border flex justify-end gap-3">
            <Button variant="outline" @click="cancelCrop">取消</Button>
            <Button variant="gradient" :disabled="uploadingAvatar" @click="confirmCrop">
              <Loader2 v-if="uploadingAvatar" class="w-4 h-4 animate-spin" /> 确认上传
            </Button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 修改个人信息弹窗 -->
    <Dialog v-model="showInfoDialog">
      <div class="space-y-5">
        <div>
          <h3 class="text-lg font-semibold">修改个人信息</h3>
          <p class="text-sm text-muted-foreground mt-1">更新你的真实姓名与学号</p>
        </div>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>真实姓名</Label>
            <Input v-model="infoForm.realName" placeholder="请输入真实姓名" />
          </div>
          <div class="space-y-2">
            <Label>学号</Label>
            <Input v-model="infoForm.studentNo" placeholder="请输入学号" />
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <Button variant="outline" @click="showInfoDialog = false">取消</Button>
          <Button variant="gradient" :disabled="savingInfo" @click="saveInfo">
            <Loader2 v-if="savingInfo" class="w-4 h-4 animate-spin" /> 保存
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import AmbientBackground from '@/components/AmbientBackground.vue'
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/useToast'
import { getBalance, redeemCdk, updateProfile, changePassword, uploadAvatar, sendCode } from '@/api'
import { Wallet, Ticket, Upload, Lock, Check, Loader2, ZoomIn, ZoomOut, Pencil } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'

const userStore = useUserStore()
const user = computed(() => userStore.user)

const avatarUrl = computed(() => (user.value?.avatar ? user.value.avatar : ''))
const defaultDisplayName = computed(() => {
  if (user.value?.displayName) return user.value.displayName
  if (user.value?.email) return user.value.email.split('@')[0]
  return ''
})
const displayInitial = computed(() => (defaultDisplayName.value || '?').charAt(0).toUpperCase())

const balance = ref(0)
const cdkCode = ref('')
const redeeming = ref(false)

const displayNameInput = ref('')
const savingName = ref(false)

const showInfoDialog = ref(false)
const infoForm = ref({ realName: '', studentNo: '' })
const savingInfo = ref(false)

const pwForm = ref({ code: '', newPassword: '', confirmPassword: '' })
const changingPw = ref(false)
const sendingCode = ref(false)
const codeCountdown = ref(0)

// ===== 修改密码：发送验证码 =====
async function sendPwCode() {
  if (!user.value?.email) return toast.warning('未绑定邮箱')
  sendingCode.value = true
  try {
    await sendCode(user.value.email)
    toast.success('验证码已发送至邮箱，请查收')
    codeCountdown.value = 60
    const timer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) clearInterval(timer)
    }, 1000)
  } finally {
    sendingCode.value = false
  }
}

onMounted(async () => {
  displayNameInput.value = defaultDisplayName.value
  try {
    const res = await getBalance()
    balance.value = res.balance
  } catch {}
})

// ===== CDK 兑换 =====
async function redeem() {
  if (!cdkCode.value.trim()) return toast.warning('请输入 CDK 码')
  redeeming.value = true
  try {
    const res = await redeemCdk(cdkCode.value.trim())
    toast.success(`兑换成功，到账 ¥${res.value}`)
    cdkCode.value = ''
    balance.value = res.balance
    userStore.setBalance(res.balance)
  } finally {
    redeeming.value = false
  }
}

// ===== 展示名 =====
async function saveDisplayName() {
  savingName.value = true
  try {
    await updateProfile({ displayName: displayNameInput.value.trim() })
    if (user.value) user.value.displayName = displayNameInput.value.trim()
    toast.success('展示名称已更新')
  } finally {
    savingName.value = false
  }
}

// ===== 修改个人信息（真实姓名 / 学号）=====
function openInfoDialog() {
  infoForm.value.realName = user.value?.realName || ''
  infoForm.value.studentNo = user.value?.studentNo || ''
  showInfoDialog.value = true
}

async function saveInfo() {
  savingInfo.value = true
  try {
    await updateProfile({
      realName: infoForm.value.realName.trim() || undefined,
      studentNo: infoForm.value.studentNo.trim() || undefined,
    })
    if (user.value) {
      user.value.realName = infoForm.value.realName.trim() || undefined
      user.value.studentNo = infoForm.value.studentNo.trim() || undefined
    }
    toast.success('个人信息已更新')
    showInfoDialog.value = false
  } finally {
    savingInfo.value = false
  }
}

// ===== 修改密码 =====
async function changePw() {
  if (!pwForm.value.code) return toast.warning('请输入邮箱验证码')
  if (pwForm.value.newPassword.length < 6) return toast.warning('新密码至少 6 位')
  if (pwForm.value.newPassword !== pwForm.value.confirmPassword) return toast.warning('两次新密码不一致')
  changingPw.value = true
  try {
    await changePassword(pwForm.value.code, pwForm.value.newPassword)
    toast.success('密码已修改')
    pwForm.value = { code: '', newPassword: '', confirmPassword: '' }
  } finally {
    changingPw.value = false
  }
}

// ===== 头像裁切 =====
const fileInput = ref<HTMLInputElement>()
const cropping = ref(false)
const cropSrc = ref('')
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const cropStage = ref<HTMLDivElement>()
const cropImg = ref<HTMLImageElement>()
const uploadingAvatar = ref(false)

let dragState: { startX: number; startY: number; ox: number; oy: number } | null = null
let baseWidth = 0
let baseHeight = 0

const imgStyle = computed(() => ({
  width: baseWidth * zoom.value + 'px',
  height: baseHeight * zoom.value + 'px',
  transform: `translate(${offsetX.value}px, ${offsetY.value}px)`,
}))

function onFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return toast.warning('请选择图片文件')
  const reader = new FileReader()
  reader.onload = () => {
    cropSrc.value = reader.result as string
    zoom.value = 1
    offsetX.value = 0
    offsetY.value = 0
    cropping.value = true
    // wait for img load
    setTimeout(() => {
      const img = cropImg.value
      const stage = cropStage.value
      if (!img || !stage) return
      baseWidth = img.naturalWidth
      baseHeight = img.naturalHeight
      const stageSize = stage.clientWidth
      // fit cover initially
      const scale = Math.max(stageSize / baseWidth, stageSize / baseHeight)
      zoom.value = scale
      centerImage()
    }, 50)
  }
  reader.readAsDataURL(file)
}

function centerImage() {
  const stage = cropStage.value
  if (!stage) return
  const s = stage.clientWidth
  const w = baseWidth * zoom.value
  const h = baseHeight * zoom.value
  offsetX.value = (s - w) / 2
  offsetY.value = (s - h) / 2
}

function startDrag(e: MouseEvent | TouchEvent) {
  const p = 'touches' in e ? e.touches[0] : e
  dragState = { startX: p.clientX, startY: p.clientY, ox: offsetX.value, oy: offsetY.value }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('touchend', endDrag)
}
function onDrag(e: MouseEvent | TouchEvent) {
  if (!dragState) return
  e.preventDefault?.()
  const p = 'touches' in e ? e.touches[0] : e
  offsetX.value = dragState.ox + (p.clientX - dragState.startX)
  offsetY.value = dragState.oy + (p.clientY - dragState.startY)
}
function endDrag() {
  dragState = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', endDrag)
}
function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? 0.95 : 1.05
  zoom.value = Math.max(0.1, Math.min(8, zoom.value * delta))
}

function cancelCrop() {
  cropping.value = false
  cropSrc.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function confirmCrop() {
  const stage = cropStage.value
  const img = cropImg.value
  if (!stage || !img) return
  const stageSize = stage.clientWidth
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')!
  // source is the visible square area of the image within the stage
  const srcX = (-offsetX.value) / zoom.value
  const srcY = (-offsetY.value) / zoom.value
  const srcSize = stageSize / zoom.value
  ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 400, 400)
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
  uploadingAvatar.value = true
  try {
    const file = new File([blob], 'avatar.png', { type: 'image/png' })
    const res: any = await uploadAvatar(file)
    if (user.value) user.value.avatar = res.avatarUrl || res.url || res.avatar
    toast.success('头像已更新')
    cropping.value = false
    cropSrc.value = ''
    if (fileInput.value) fileInput.value.value = ''
  } finally {
    uploadingAvatar.value = false
  }
}
</script>
