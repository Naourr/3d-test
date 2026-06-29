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
camera.position.setZ(30)

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
    spaceship.position.set(0, 2, 0)
    scene.add(spaceship)
})

const pointlight = new THREE.PointLight(0xffffff, 2000)
pointlight.position.set(20, 10, 10)

const ambientlight = new THREE.AmbientLight(0xffffff, 1)
scene.add(pointlight, ambientlight)

const lightHelper = new THREE.PointLightHelper(pointlight)
const gridHelper = new THREE.GridHelper(200, 50)
scene.add(lightHelper, gridHelper)

const controls = new OrbitControls(camera, renderer.domElement)

const spaceTexture = new THREE.TextureLoader().load('/techy-bg.jpg')
spaceTexture.colorSpace = THREE.SRGBColorSpace
scene.background = spaceTexture

function animate() {
    requestAnimationFrame(animate)

    if (spaceship) {
        spaceship.rotation.y += 0.003
    }

    controls.update()
    renderer.render(scene, camera)
}
animate()