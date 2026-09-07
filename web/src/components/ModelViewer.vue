<template>
  <div class="model-viewer">
    <div
      ref="container"
      class="viewer-canvas"
      tabindex="0"
      @mousedown.prevent="onMouseDown"
      @mouseup="onMouseUp"
      @mousemove="onMouseMove"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    ></div>
    <div class="viewer-hint">
      <span class="hint-item"><kbd>左键拖动</kbd> 平移视角</span>
      <span class="hint-item"><kbd>中键拖动</kbd> 旋转视角</span>
      <span class="hint-item"><kbd>W A S D</kbd> 移动摄像机</span>
      <span class="hint-item"><kbd>滚轮</kbd> 缩放</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

const props = defineProps<{ modelUrl: string }>()

const container = ref<HTMLDivElement>()

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let mesh: THREE.Mesh
let rafId = 0

// 相机控制状态
let yaw = 0       // 水平朝向角
let pitch = 0     // 垂直朝向角
const moveState = { forward: false, back: false, left: false, right: false }
const dragState = { panning: false, rotating: false, lastX: 0, lastY: 0 }

const MOVE_SPEED = 8      // WASD 移动速度 (单位/秒)
const PAN_SPEED = 0.015   // 左键平移灵敏度
const ROT_SPEED = 0.003   // 中键旋转灵敏度
const ZOOM_SPEED = 0.1    // 滚轮缩放灵敏度

function getToken(): string {
  return localStorage.getItem('token') || ''
}

function init() {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(0, 0, 30)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.value.appendChild(renderer.domElement)

  // 灯光
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(10, 20, 10)
  scene.add(dir)

  // 网格地面
  const grid = new THREE.GridHelper(50, 50, 0x444466, 0x2a2a3e)
  grid.position.y = -0.01
  scene.add(grid)

  loadModel()
  animate()
}

async function loadModel() {
  if (!props.modelUrl) return
  try {
    const res = await fetch(props.modelUrl, {
      headers: { Authorization: 'Bearer ' + getToken() },
    })
    if (!res.ok) return
    const buffer = await res.arrayBuffer()
    const loader = new STLLoader()
    const geometry = loader.parse(buffer)
    geometry.computeVertexNormals()
    // 居中并缩放到合适大小
    geometry.center()
    const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry))
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scale = 10 / maxDim
    geometry.scale(scale, scale, scale)

    // 灰色材质（灰模）
    const material = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      flatShading: true,
      side: THREE.DoubleSide,
    })
    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
  } catch (e) {
    console.error('模型加载失败', e)
  }
}

function animate() {
  rafId = requestAnimationFrame(animate)
  updateCameraMovement()
  renderer.render(scene, camera)
}

// 根据 yaw/pitch 计算相机朝向向量
function getForward(): THREE.Vector3 {
  return new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  )
}
function getRight(): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
}

function updateCameraMovement() {
  let dx = 0, dz = 0
  if (moveState.forward) { dz -= 1 }
  if (moveState.back) { dz += 1 }
  if (moveState.left) { dx -= 1 }
  if (moveState.right) { dx += 1 }
  if (dx === 0 && dz === 0) return

  // 沿相机真实朝向（含俯仰）移动，Unity 第一人称风格
  const fwd = getForward().normalize()
  const right = getRight().normalize()
  const move = new THREE.Vector3()
    .addScaledVector(fwd, -dz)
    .addScaledVector(right, dx)
    .normalize()
    .multiplyScalar(MOVE_SPEED / 60)
  camera.position.add(move)
  camera.lookAt(camera.position.clone().add(fwd))
}

function onMouseDown(e: MouseEvent) {
  // 阻止中键自动滚动（auto-scroll）默认行为
  if (e.button === 1) e.preventDefault()
  container.value?.focus()
  dragState.lastX = e.clientX
  dragState.lastY = e.clientY
  if (e.button === 0) dragState.panning = true
  if (e.button === 1) dragState.rotating = true
}
function onMouseUp(e: MouseEvent) {
  if (e.button === 0) dragState.panning = false
  if (e.button === 1) dragState.rotating = false
}
function onMouseMove(e: MouseEvent) {
  const dx = e.clientX - dragState.lastX
  const dy = e.clientY - dragState.lastY
  dragState.lastX = e.clientX
  dragState.lastY = e.clientY

  if (dragState.panning) {
    // 左键拖动 = 平移（沿相机 right 和 up 方向）
    const right = getRight()
    const up = new THREE.Vector3(0, 1, 0)
    camera.position.addScaledVector(right, -dx * PAN_SPEED)
    camera.position.addScaledVector(up, dy * PAN_SPEED)
    camera.lookAt(camera.position.clone().add(getForward()))
  }
  if (dragState.rotating) {
    // 中键拖动 = 旋转朝向
    yaw -= dx * ROT_SPEED
    pitch -= dy * ROT_SPEED
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
    camera.lookAt(camera.position.clone().add(getForward()))
  }
}

function onWheel(e: WheelEvent) {
  const fwd = getForward()
  const dist = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED
  camera.position.addScaledVector(fwd, dist * 2)
}

function onKeyDown(e: KeyboardEvent) {
  switch (e.key.toLowerCase()) {
    case 'w': moveState.forward = true; break
    case 's': moveState.back = true; break
    case 'a': moveState.left = true; break
    case 'd': moveState.right = true; break
  }
}
function onKeyUp(e: KeyboardEvent) {
  switch (e.key.toLowerCase()) {
    case 'w': moveState.forward = false; break
    case 's': moveState.back = false; break
    case 'a': moveState.left = false; break
    case 'd': moveState.right = false; break
  }
}

function onResize() {
  if (!container.value || !camera || !renderer) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  init()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
  if (container.value && renderer.domElement.parentNode === container.value) {
    container.value.removeChild(renderer.domElement)
  }
})

watch(() => props.modelUrl, () => {
  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  }
  loadModel()
})
</script>

<style scoped>
.model-viewer {
  width: 100%;
}
.viewer-canvas {
  width: 100%;
  height: 420px;
  border-radius: 12px;
  overflow: hidden;
  outline: none;
  cursor: grab;
  background: #1a1a2e;
}
.viewer-canvas:active {
  cursor: grabbing;
}
.viewer-canvas:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}
.viewer-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}
.hint-item kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 0.75rem;
  font-family: monospace;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  margin-right: 4px;
}
</style>
