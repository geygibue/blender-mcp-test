import Phaser from 'phaser'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { enable3d, Canvas, Scene3D } from '@enable3d/phaser-extension'
import { Smoke } from './smoke.js'

// A factory.glb alaprajza 10x10 m, az alapozással együtt 11x11 m.
const FOOTPRINT = 11
const GAP = 10 // a gyárak közti szabad távolság méterben (szélektől mérve)
const COUNT = 3

// ovális pálya a gyárak körül (ellipszis fél tengelyei, méter)
const TRACK_A = 36 // X irány
const TRACK_B = 16 // Z irány
const TRUCK_SPEED = 8 // m/s
const CAMERA_SPEED = 20 // m/s (WASD), Shift-tel gyorsabb

class MainScene extends Scene3D {
  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  async create() {
    const { third } = this
    third.renderer.shadowMap.enabled = true
    third.scene.background = new THREE.Color(0x8fb8d8)
    this.smokes = []

    // fények
    third.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 0.9))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(30, 50, 25)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 150 })
    third.scene.add(sun)

    // talaj
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x6f8f5a, roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    third.scene.add(ground)

    // gyárak
    const gltf = await third.load.gltf(`${import.meta.env.BASE_URL}factory.glb`)
    const pitch = FOOTPRINT + GAP
    for (let i = 0; i < COUNT; i++) {
      const factory = gltf.scene.clone(true)
      factory.position.x = (i - (COUNT - 1) / 2) * pitch
      factory.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
      third.scene.add(factory)
      // kémények (Blender x,y,z -> three x,z,-y): sötétebb, sűrű füst
      for (const [cx, cy, cz] of [
        [3.2, 10.9, -3.2],
        [2.0, 9.6, -3.2],
      ]) {
        this.smokes.push(
          new Smoke(third.scene, new THREE.Vector3(factory.position.x + cx, cy, cz), {
            color: 0x4a4a4a, rate: 5, life: 5, rise: 2.5, size0: 0.7, size1: 3.5, opacity: 0.6,
          })
        )
      }
    }

    // erőművek (a gyárak mögött, a teherautó pályáján kívül)
    const plantGltf = await third.load.gltf(`${import.meta.env.BASE_URL}powerplant.glb`)
    for (const x of [-16, 16]) {
      const plant = plantGltf.scene.clone(true)
      plant.position.set(x, 0, -34)
      plant.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true
          o.receiveShadow = true
        }
      })
      third.scene.add(plant)
      // magas kémény: szürke füst; hűtőtorony: nagy, világos gőzfelhő
      this.smokes.push(
        new Smoke(third.scene, new THREE.Vector3(x - 2.5, 17.4, -34 - 2.4), {
          color: 0x606060, rate: 6, life: 7, rise: 3, size0: 1, size1: 6, opacity: 0.55,
        }),
        new Smoke(third.scene, new THREE.Vector3(x + 2.75, 8.4, -34 - 2.6), {
          color: 0xf0f0f0, rate: 9, life: 7, rise: 2.5, size0: 2.5, size1: 9, opacity: 0.4, spread: 1.6,
        })
      )
    }

    // teherautó
    const truckGltf = await third.load.gltf(`${import.meta.env.BASE_URL}truck.glb`)
    this.truck = truckGltf.scene
    this.truck.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.truckT = 0
    third.scene.add(this.truck)
    this.placeTruck()

    // kamera
    third.camera.position.set(0, 40, 55)

    // jobb egérgomb nyomva tartva: forgatás; a talaj alá nem lehet benézni
    this.controls = new OrbitControls(third.camera, this.game.canvas)
    this.controls.target.set(0, 2, -8)
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05 // legfeljebb a horizont fölé
    this.controls.minDistance = 10
    this.controls.maxDistance = 90
    this.controls.update()

    // WASD: a kamera (és a forgatás középpontja) mozog a talaj síkján
    this.keys = new Set()
    window.addEventListener('keydown', (e) => this.keys.add(e.code))
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
    this.forward = new THREE.Vector3()
    this.right = new THREE.Vector3()
    this.move = new THREE.Vector3()
  }

  moveCamera(dt) {
    const k = this.keys
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0)
    const r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    if (!f && !r) return
    const cam = this.third.camera
    cam.getWorldDirection(this.forward)
    this.forward.y = 0
    this.forward.normalize()
    this.right.crossVectors(this.forward, cam.up).normalize()
    const speed = CAMERA_SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 2.5 : 1)
    this.move.set(0, 0, 0).addScaledVector(this.forward, f).addScaledVector(this.right, r)
    this.move.normalize().multiplyScalar(speed * dt)
    cam.position.add(this.move)
    this.controls.target.add(this.move)
  }

  // a teherautó helye és iránya az ellipszis t paraméterénél (a modell eleje +Z)
  placeTruck() {
    const t = this.truckT
    this.truck.position.set(TRACK_A * Math.cos(t), 0, TRACK_B * Math.sin(t))
    const dx = -TRACK_A * Math.sin(t)
    const dz = TRACK_B * Math.cos(t)
    this.truck.rotation.y = Math.atan2(dx, dz)
    return Math.hypot(dx, dz)
  }

  update(_time, delta) {
    if (this.truck) {
      // állandó sebesség az ellipszis mentén: dt = v * dtIdő / |sebességvektor|
      const speed = Math.hypot(-TRACK_A * Math.sin(this.truckT), TRACK_B * Math.cos(this.truckT))
      this.truckT += (TRUCK_SPEED * (delta / 1000)) / speed
      this.placeTruck()
    }
    const dt = Math.min(delta / 1000, 0.1)
    for (const s of this.smokes) s.update(dt)
    if (this.controls) {
      this.moveCamera(delta / 1000)
      this.controls.update()
    }
  }
}

enable3d(
  () =>
    new Phaser.Game({
      type: Phaser.WEBGL,
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scene: [MainScene],
      ...Canvas(),
    })
)
