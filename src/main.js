import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'

window.addEventListener('load', () => {
    const loading = document.querySelector('.loading')
    loading.classList.add('hidden')
})
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

// CAMERA AND LIGHTING
camera.position.setZ(-25)
camera.position.setY(15)
camera.position.setX(-10)

const ambientlight = new THREE.AmbientLight(0xffffff, 1.8)
scene.add(ambientlight)
const pointlight = new THREE.PointLight(0xffffff, 5000, 100)
pointlight.position.set(0, 5, 10) 
camera.add(pointlight)
scene.add(camera)
const controls = new OrbitControls(camera, renderer.domElement)

// PLAYER SHIP AND CONTROLS
let spaceship; 
const gltfloader = new GLTFLoader()
gltfloader.load('/spaceship.glb', (gltf) => {
    spaceship = gltf.scene
    spaceship.traverse((child) => {
        if (child.isMesh) {
            child.geometry.center()
        }
    })
    spaceship.scale.set(20, 20, 20) 
    spaceship.position.set(0, 0, 0)
    scene.add(spaceship)
})
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
}
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase()
    if (key in keys) keys[key] = true
})

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase()
    if (key in keys) keys[key] = false
})

// FIXED BG
const spaceTexture = new THREE.TextureLoader().load('/techy-bg.jpg')
spaceTexture.colorSpace = THREE.SRGBColorSpace
scene.background = spaceTexture

// PARTICLE EFFECT
const particleCount = 700;
const particleGeometry = new THREE.BufferGeometry()
const positions = new Float32Array(particleCount * 3)
for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i]     = (Math.random() - 0.5) * 200
    positions[i + 1] = (Math.random() - 0.5) * 100
    positions[i + 2] = Math.random() * -300
}
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
const particleMaterial = new THREE.PointsMaterial({
    color: 0x00FFDD,
    size: 0.6,
    transparent: true,
    opacity: 0.5
})
const matrixRain = new THREE.Points(particleGeometry, particleMaterial)

// CYLINDRICAL TUNNEL
const tunnelGeo = new THREE.CylinderGeometry(40, 40, 800, 16, 20, true)
tunnelGeo.rotateX(Math.PI / 2)
const tunnelMat = new THREE.MeshBasicMaterial({
    color: 0x00ffdd,
    wireframe: true,
    transparent: true,
    opacity: 0.15
})
const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat)
tunnel.position.set(0, 0, -300)
scene.add(tunnel)

// ON START BUTTON CLICK
let gameState = 'MENU'
const start = document.querySelector('.button')
function startGame() {
    gameState = 'PLAYING'
    controls.enabled = false
    start.classList.add('hidden')
}
start.addEventListener('click', startGame)

// RENDER CHANGES
function animate() {
    requestAnimationFrame(animate)
    if (gameState === 'MENU') {
        controls.update()
    } else if (gameState === 'PLAYING') {
        if (spaceship) {
            // CAMERA POSITIONING
            camera.position.x += (spaceship.position.x - camera.position.x) * 0.1
            camera.position.y += (spaceship.position.y + 5 - camera.position.y) * 0.1
            camera.position.z += (spaceship.position.z + 24 - camera.position.z) * 0.1
            camera.lookAt(spaceship.position)

            // PLAYER SHIP MOVEMENT
            const moveSpeed = 1
            let targetTilt = 0
            if (keys.a) {
                spaceship.position.x -= moveSpeed
                targetTilt = 0.3
            } else if (keys.d) {
                spaceship.position.x += moveSpeed
                targetTilt = -0.3
            }
            if (keys.w) {
                spaceship.position.y += moveSpeed
            } else if (keys.s) {
                spaceship.position.y -= moveSpeed
            }
            spaceship.rotation.z += (targetTilt - spaceship.rotation.z) * 0.1
            spaceship.rotation.y = 0
            spaceship.rotation.x = 0

            // ADD PARTICLE EFFECT AND LOOPING
            scene.add(matrixRain);
            const positionAttribute = matrixRain.geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                let z = positionAttribute.getZ(i)
                z += 2.5
                if (z > camera.position.z) {
                    z = -300; 
                    positionAttribute.setX(i, (Math.random() - 0.5) * 200)
                    positionAttribute.setY(i, (Math.random() - 0.5) * 100)
                }
                positionAttribute.setZ(i, z)
            }
            positionAttribute.needsUpdate = true

            // ADD CYLINDRICAL TUNNEL AND LOOPING
            tunnel.position.z += 1.5; 
            if (tunnel.position.z >= 40) {
                tunnel.position.z = 0; 
            }
            // SET PLAYER SHIP MAX BOUNDS
            spaceship.position.x = Math.max(-30, Math.min(30, spaceship.position.x))
            spaceship.position.y = Math.max(-20, Math.min(20, spaceship.position.y))
        }
    }
    renderer.render(scene, camera)
}
animate()