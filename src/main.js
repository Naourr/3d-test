import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'

window.addEventListener('load', () => {
    const loading = document.querySelector('.loading')
    if (loading) loading.classList.add('hidden')
})

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    alpha: true
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

let gameState = 'MENU'
let activeObstacles = []
let obstacleSpawnTimer
let obstacleSpawnInterval
let obstacleTimeout
let gameSpeed = 2.5
let playerHealth = 100
let isInvulnerable = false
let flash_interval
let speedup
const playerBox = new THREE.Box3()
const obstacleBox = new THREE.Box3()

// DOM ELEMENTS
const start = document.querySelector('.button')
const healthUI = document.getElementById('health-ui')

// CAMERA AND LIGHTING
const ambientlight = new THREE.AmbientLight(0xffffff, 1.2)
scene.add(ambientlight)

const pointlight = new THREE.PointLight(0xffffff, 8000, 100, 2)
pointlight.position.set(0, 10, 15)
camera.add(pointlight)
scene.add(camera)
const controls = new OrbitControls(camera, renderer.domElement)

// PLAYER SHIP AND CONTROLS
let spaceship 
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

// DESKTOP CONTROLS (WASD)
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

// MOBILE CONTROLS
const base = document.getElementById('joystick-base')
const stick = document.getElementById('joystick-stick')

if (base && stick) {
    let joystickActive = false
    let startX = 0
    let startY = 0
    const maxRadius = 40

    base.addEventListener('pointerdown', (e) => {
        if (gameState !== 'PLAYING') return
        joystickActive = true
        startX = e.clientX
        startY = e.clientY
        
        base.setPointerCapture(e.pointerId) 
    })

    base.addEventListener('pointermove', (e) => {
        if (!joystickActive) return
        
        let deltaX = e.clientX - startX
        let deltaY = e.clientY - startY
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance > maxRadius) {
            deltaX = (deltaX / distance) * maxRadius
            deltaY = (deltaY / distance) * maxRadius
        }

        stick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`

        const threshold = 12

        keys.a = deltaX < -threshold
        keys.d = deltaX > threshold
        keys.w = deltaY < -threshold
        keys.s = deltaY > threshold
    })

    const stopJoystick = (e) => {
        if (!joystickActive) return
        joystickActive = false
        stick.style.transform = 'translate(-50%, -50%)'
        keys.a = false
        keys.d = false
        keys.w = false
        keys.s = false
        
        try {
            base.releasePointerCapture(e.pointerId)
        } catch(err) {}
    }

    base.addEventListener('pointerup', stopJoystick)
    base.addEventListener('pointercancel', stopJoystick)
}

// PARTICLE EFFECT
const particleCount = 700
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
scene.add(matrixRain)

// CYLINDRICAL TUNNEL
const tunnelGeo = new THREE.CylinderGeometry(40, 40, 1000, 16, 20, true)
tunnelGeo.rotateX(Math.PI / 2)
const tunnelMat = new THREE.MeshBasicMaterial({
    color: 0x00ffdd,
    wireframe: true,
    transparent: true,
    opacity: 0.15
})
const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat)
tunnel.position.set(0, 0, -400)
scene.add(tunnel)

// OBSTACLES
const obstacleMat = new THREE.MeshStandardMaterial({ 
    color: 0x3a3a3a,
    roughness: 0.5,
    metalness: 0.8
})

function createSemiCircleWall() {
    const geo = new THREE.CylinderGeometry(40, 40, 5, 24, 1, false, 0, Math.PI)
    geo.rotateX(Math.PI / 2)
    return new THREE.Mesh(geo, obstacleMat)
}
function createDividerWall() {
    const geo = new THREE.BoxGeometry(80, 12, 5)
    return new THREE.Mesh(geo, obstacleMat)
}

function spawnObstacle() {
    if (gameState !== 'PLAYING') return
    const type = Math.floor(Math.random() * 2)
    let obstacle
    if (type === 0) obstacle = createSemiCircleWall()
    else obstacle = createDividerWall()
    
    const randomNum = Math.floor(Math.random() * 4)
    
    let randomAngle
    if (randomNum === 0) randomAngle = THREE.MathUtils.degToRad(0)
    else if (randomNum === 1) randomAngle = THREE.MathUtils.degToRad(90)
    else if (randomNum === 2) randomAngle = THREE.MathUtils.degToRad(180)
    else randomAngle = THREE.MathUtils.degToRad(-90)
    
    obstacle.rotation.z = randomAngle
    obstacle.position.set(0, 0, -600)
    scene.add(obstacle)
    activeObstacles.push(obstacle)
}

function dynamicSpawnLoop() {
    if (gameState !== 'PLAYING') return;
    spawnObstacle();
    let currentSpawnDelay = 4000 / gameSpeed; 
    if (currentSpawnDelay < 300) currentSpawnDelay = 300;
    obstacleTimeout = setTimeout(dynamicSpawnLoop, currentSpawnDelay);
}

// SHENANIGANS
const flash_img = document.querySelector('.flash-img')
const flash_imgs = [
    "/cat.jpg",
    "/cat1.webp",
    "/cat2.jpg",
    "/cat3.webp",
    "/donkey.jpg",
    "/hart.jpg",
    "/sunshine.jpg",
]
function flash() {
    const randNum = Math.floor(Math.random() * 20)
    if (flash_imgs[randNum]) {
        flash_img.style.backgroundImage = `url(${flash_imgs[randNum]})`
        setTimeout(() => {
            flash_img.style.backgroundImage = `url()`
        }, 150)
    }
}

function lobby() {
    gameState = 'MENU'
    controls.enabled = true
    if (start) start.classList.remove('hidden')
    playerHealth = 100
    if (healthUI) healthUI.innerText = `HP: 100`
    
    clearTimeout(obstacleTimeout)
    clearInterval(flash_interval)
    
    activeObstacles.forEach(obs => scene.remove(obs))
    activeObstacles = []
    
    if (spaceship) {
        spaceship.position.set(0, 0, 0)
        spaceship.rotation.set(0, 0, 0)
    }
    
    camera.position.set(-10, 15, 25)
    controls.target.set(0, 0, 0)
    camera.lookAt(0, 0, 0)
    controls.update()
}

// ON START BUTTON CLICK
function startGame() {
    gameState = 'PLAYING'
    controls.enabled = false
    if (start) start.classList.add('hidden')
    
    gameSpeed = 2.5
    
    clearTimeout(obstacleTimeout)
    dynamicSpawnLoop()

    clearInterval(speedup)
    speedup = setInterval(() => {
        gameSpeed += 0.2;
        console.log(`Speed: ${gameSpeed.toFixed(1)} | Next Spawn Delay: ${(4000 / gameSpeed).toFixed(0)}ms`)
    }, 3000)
    
    clearInterval(flash_interval)
    flash_interval = setInterval(flash, 5000)
}
if (start) start.addEventListener('click', startGame)
lobby()

// RENDER CHANGES
function animate() {
    requestAnimationFrame(animate)
    if (gameState === 'MENU') {
        controls.update()

    } else if (gameState === 'PLAYING') {
        if (spaceship) {
            // CAMERA POSITIONING
            camera.position.x += (spaceship.position.x - camera.position.x) * 0.2
            camera.position.y += (spaceship.position.y + 5 - camera.position.y) * 0.2
            camera.position.z += (spaceship.position.z + 24 - camera.position.z) * 0.2
            camera.lookAt(spaceship.position)

            // PLAYER SHIP MOVEMENT
            const moveSpeed = 1.4
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

            // PARTICLE EFFECT LOOPING
            const positionAttribute = matrixRain.geometry.attributes.position
            for (let i = 0; i < positionAttribute.count; i++) {
                let z = positionAttribute.getZ(i)
                z += gameSpeed
                if (z > camera.position.z) {
                    z = -300 
                    positionAttribute.setX(i, (Math.random() - 0.5) * 200)
                    positionAttribute.setY(i, (Math.random() - 0.5) * 100)
                }
                positionAttribute.setZ(i, z)
            }
            positionAttribute.needsUpdate = true

            // ADD CYLINDRICAL TUNNEL AND LOOPING
            tunnel.position.z += gameSpeed 
            if (tunnel.position.z >= 40) {
                tunnel.position.z = 0 
            }

            // ADD PLAYER MAX BOUNDS
            spaceship.position.x = Math.max(-30, Math.min(30, spaceship.position.x))
            spaceship.position.y = Math.max(-20, Math.min(20, spaceship.position.y))

            // REUSE GLOBAL BOX TO CALCULATE SHIP BOUNDS
            playerBox.setFromObject(spaceship)
            playerBox.expandByScalar(-1.5)


            for (let i = activeObstacles.length - 1; i >= 0; i--) {
                const obstacle = activeObstacles[i]
                obstacle.position.z += gameSpeed
                
                // REUSE GLOBAL BOX FOR OBSTACLES
                obstacleBox.setFromObject(obstacle)
                obstacleBox.expandByScalar(-1.0)

                if (!isInvulnerable) {
                    if (playerBox.intersectsBox(obstacleBox)) {
                        takeDamage(10)
                    }
                }

                if (obstacle.position.z > camera.position.z + 10) {
                    scene.remove(obstacle)
                    activeObstacles.splice(i, 1)
                }
            }
        }
    }
    renderer.render(scene, camera)
}
animate()

function takeDamage(amount) {
    playerHealth -= amount
    if (healthUI) healthUI.innerText = `HP: ${playerHealth}`

    // FLASH RED EFFECT
    if (spaceship) {
        spaceship.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!child.userData.originalColor) {
                    child.userData.originalColor = child.material.color.clone()
                }
                child.material.color.setHex(0xff0055)
            }
        })

        setTimeout(() => {
            spaceship.traverse((child) => {
                if (child.isMesh && child.material && child.userData.originalColor) {
                    child.material.color.copy(child.userData.originalColor)
                }
            })
        }, 200)
    }

    // GAME OVER CHECK
    if (playerHealth <= 0) {
        lobby()
        return
    }

    // INVULNERABILITY
    isInvulnerable = true
    setTimeout(() => {
        isInvulnerable = false
    }, 1000)
}