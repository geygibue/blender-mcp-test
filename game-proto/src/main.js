import Phaser from 'phaser'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { enable3d, Canvas, Scene3D } from '@enable3d/phaser-extension'

// A factory.glb alaprajza 10x10 m, az alapozással együtt 11x11 m.
const FOOTPRINT = 11
const GAP = 10 // a gyárak közti szabad távolság méterben (szélektől mérve)
const COUNT = 3

// ovális pálya a gyárak körül (ellipszis fél tengelyei, méter)
const TRACK_A = 36 // X irány
const TRACK_B = 16 // Z irány
const TRUCK_SPEED = 8 // m/s

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
    third.camera.position.set(0, 30, 42)

    // jobb egérgomb nyomva tartva: forgatás; a talaj alá nem lehet benézni
    this.controls = new OrbitControls(third.camera, this.game.canvas)
    this.controls.target.set(0, 2, 0)
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05 // legfeljebb a horizont fölé
    this.controls.minDistance = 10
    this.controls.maxDistance = 90
    this.controls.update()
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
    this.controls?.update()
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
