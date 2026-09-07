<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement>()

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let frameId = 0
let mouseX = 0
let mouseY = 0
let targetX = 0
let targetY = 0

const meshes: THREE.Mesh[] = []

function buildScene() {
  const el = container.value!
  const width = el.clientWidth
  const height = el.clientHeight

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
  camera.position.z = 8

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  el.appendChild(renderer.domElement)

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 1.2)
  dir.position.set(5, 5, 5)
  scene.add(dir)
  const point1 = new THREE.PointLight(0x6366f1, 2, 50)
  point1.position.set(-5, 3, 3)
  scene.add(point1)
  const point2 = new THREE.PointLight(0x8b5cf6, 2, 50)
  point2.position.set(5, -3, 2)
  scene.add(point2)

  // Icosahedron (wireframe-ish with low opacity fill)
  const icoGeo = new THREE.IcosahedronGeometry(1.6, 1)
  const icoMat = new THREE.MeshStandardMaterial({
    color: 0x6366f1,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
  })
  const ico = new THREE.Mesh(icoGeo, icoMat)
  ico.position.set(-2.2, 0.4, 0)
  scene.add(ico)
  meshes.push(ico)

  // Wireframe overlay for icosahedron
  const wireGeo = new THREE.IcosahedronGeometry(1.62, 1)
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 })
  const wire = new THREE.Mesh(wireGeo, wireMat)
  wire.position.copy(ico.position)
  scene.add(wire)
  meshes.push(wire)

  // Torus knot
  const knotGeo = new THREE.TorusKnotGeometry(0.9, 0.28, 120, 16)
  const knotMat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    metalness: 0.6,
    roughness: 0.25,
    transparent: true,
    opacity: 0.9,
  })
  const knot = new THREE.Mesh(knotGeo, knotMat)
  knot.position.set(2.4, -0.3, -1)
  scene.add(knot)
  meshes.push(knot)

  // Small floating octahedrons
  for (let i = 0; i < 4; i++) {
    const g = new THREE.OctahedronGeometry(0.3 + Math.random() * 0.25, 0)
    const m = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0xec4899 : 0x22d3ee,
      metalness: 0.4,
      roughness: 0.3,
      transparent: true,
      opacity: 0.7,
      flatShading: true,
    })
    const o = new THREE.Mesh(g, m)
    o.position.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3 - 1)
    o.userData.speed = 0.3 + Math.random() * 0.5
    o.userData.phase = Math.random() * Math.PI * 2
    scene.add(o)
    meshes.push(o)
  }

  // Particle field
  const particleCount = 400
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const pMat = new THREE.PointsMaterial({
    color: 0x6366f1,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  })
  const particles = new THREE.Points(pGeo, pMat)
  scene.add(particles)
  meshes.push(particles as unknown as THREE.Mesh)
}

const startTime = performance.now()

function animate() {
  frameId = requestAnimationFrame(animate)
  const t = (performance.now() - startTime) / 1000

  // Smooth mouse parallax
  targetX += (mouseX - targetX) * 0.05
  targetY += (mouseY - targetY) * 0.05

  meshes.forEach((m, i) => {
    if (m instanceof THREE.Points) {
      m.rotation.y = t * 0.03
      m.rotation.x = targetY * 0.2
      return
    }
    if (i === 0) {
      // ico
      m.rotation.y = t * 0.3
      m.rotation.x = t * 0.15
      m.position.y = 0.4 + Math.sin(t * 0.8) * 0.3
    } else if (i === 1) {
      m.rotation.y = t * 0.3
      m.rotation.x = t * 0.15
      m.position.y = 0.4 + Math.sin(t * 0.8) * 0.3
    } else if (i === 2) {
      // knot
      m.rotation.x = t * 0.5
      m.rotation.y = t * 0.4
      m.position.y = -0.3 + Math.sin(t * 0.6 + 1) * 0.25
    } else {
      // small octahedrons
      const speed = m.userData.speed
      const phase = m.userData.phase
      m.rotation.x = t * speed
      m.rotation.y = t * speed * 0.8
      m.position.y += Math.sin(t * speed + phase) * 0.003
    }
  })

  camera.position.x = targetX * 0.6
  camera.position.y = -targetY * 0.4
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
}

function onMouseMove(e: MouseEvent) {
  const el = container.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1
}

function onResize() {
  const el = container.value
  if (!el || !renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  buildScene()
  animate()
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMouseMove)
  meshes.forEach((m) => {
    m.geometry.dispose()
    const mat = m.material
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat.dispose()
  })
  renderer.dispose()
  if (container.value && renderer.domElement.parentNode === container.value) {
    container.value.removeChild(renderer.domElement)
  }
})
</script>

<template>
  <div ref="container" class="absolute inset-0 overflow-hidden"></div>
</template>
