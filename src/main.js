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
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

let gameState = 'MENU'
let activeObstacles = []
let obstacleSpawnTimer
let obstacleHelpers = []
let playerHelper
let gameSpeed = 3
let playerHealth = 100
let isInvulnerable = false

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

// FIXED BG
const spaceTexture = new THREE.TextureLoader().load('/techy-bg.jpg')
spaceTexture.colorSpace = THREE.SRGBColorSpace
scene.background = spaceTexture

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

// function createGateWall() {
//     const group = new THREE.Group()
//     const leftGeo = new THREE.CylinderGeometry(40, 40, 5, 12, 1, false, 0, 1.1)
//     leftGeo.rotateX(Math.PI / 2)
//     const leftMesh = new THREE.Mesh(leftGeo, obstacleMat)
//     const rightGeo = new THREE.CylinderGeometry(40, 40, 5, 12, 1, false, 2.0, 1.1)
//     rightGeo.rotateX(Math.PI / 2)
//     const rightMesh = new THREE.Mesh(rightGeo, obstacleMat)
//     group.add(leftMesh, rightMesh)
//     return group
// }

function createDividerWall() {
    const geo = new THREE.BoxGeometry(80, 12, 5)
    return new THREE.Mesh(geo, obstacleMat)
}

// function createRingGateWall() {
//     const geo = new THREE.RingGeometry(20, 40, 32)
//     const flatRingMat = new THREE.MeshStandardMaterial({ 
//         color: 0x3a3a3a,
//         roughness: 0.5,
//         metalness: 0.8,
//         side: THREE.DoubleSide
//     })
//     const mesh = new THREE.Mesh(geo, flatRingMat)
//     return mesh
// }

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

function lobby() {
    gameState = 'MENU'
    controls.enabled = true
    if (start) start.classList.remove('hidden')
    playerHealth = 100
    if (healthUI) healthUI.innerText = `HP: 100`
    
    clearInterval(obstacleSpawnTimer)
    
    activeObstacles.forEach(obs => scene.remove(obs))
    activeObstacles = []
    
    obstacleHelpers.forEach(helper => scene.remove(helper))
    obstacleHelpers = []
    if (playerHelper) {
        scene.remove(playerHelper)
        playerHelper = null
    }
    
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
    
    clearInterval(obstacleSpawnTimer);
    obstacleSpawnTimer = setInterval(spawnObstacle, 1500);
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
            // SET PLAYER SHIP MAX BOUNDS
            spaceship.position.x = Math.max(-30, Math.min(30, spaceship.position.x))
            spaceship.position.y = Math.max(-20, Math.min(20, spaceship.position.y))

            // MOVE AND CLEANUP OBSTACLES
            obstacleHelpers.forEach(helper => scene.remove(helper))
            obstacleHelpers = []
            if (playerHelper) scene.remove(playerHelper)

            if (spaceship) {
                const playerBox = new THREE.Box3().setFromObject(spaceship)
                playerBox.expandByScalar(-1.5)
                
                // PLAYER HITBOX HELPER
                // playerHelper = new THREE.Box3Helper(playerBox, 0x00ff00)
                // scene.add(playerHelper)

                for (let i = activeObstacles.length - 1; i >= 0; i--) {
                    const obstacle = activeObstacles[i]
                    obstacle.position.z += gameSpeed
                    
                    const obstacleBox = new THREE.Box3().setFromObject(obstacle)
                    obstacleBox.expandByScalar(-1.0)
                    
                    // OBSTACLE HITBOX HELPER
                    // const obsHelper = new THREE.Box3Helper(obstacleBox, 0xff0000)
                    // scene.add(obsHelper)
                    // obstacleHelpers.push(obsHelper)

                    if (!isInvulnerable) {
                        if (playerBox.intersectsBox(obstacleBox)) {
                            takeDamage(25)
                        }
                    }

                    if (obstacle.position.z > camera.position.z + 10) {
                        scene.remove(obstacle)
                        activeObstacles.splice(i, 1)
                    }
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
        alert("ded")
        lobby()
        return
    }

    // INVULNERABILITY
    isInvulnerable = true
    setTimeout(() => {
        isInvulnerable = false
    }, 1200)
}