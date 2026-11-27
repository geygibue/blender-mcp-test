import * as THREE from 'three'

// puha, kör alakú füst-textúra (egyszer generálva, minden részecske ezt használja)
function makeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const texture = makeTexture()
const WIND = new THREE.Vector3(1.2, 0, 0.4) // m/s, enyhe szél

/**
 * Egy kémény füstje. A részecskék a világkoordinátában mozognak, így a szél elfújja őket.
 * opts: { color, rate (db/s), life (s), rise (m/s), size0, size1, opacity }
 */
export class Smoke {
  constructor(scene, position, opts = {}) {
    this.scene = scene
    this.origin = position.clone()
    this.color = opts.color ?? 0x555555
    this.rate = opts.rate ?? 6
    this.life = opts.life ?? 5
    this.rise = opts.rise ?? 2.5
    this.size0 = opts.size0 ?? 0.8
    this.size1 = opts.size1 ?? 4
    this.opacity = opts.opacity ?? 0.55
    this.spread = opts.spread ?? 0.25
    this.parts = []
    this.pool = []
    this.acc = Math.random() // fáziseltolás, hogy ne szinkronban füstöljenek
  }

  spawn() {
    let p = this.pool.pop()
    if (!p) {
      const mat = new THREE.SpriteMaterial({
        map: texture,
        color: this.color,
        transparent: true,
        depthWrite: false,
      })
      p = { sprite: new THREE.Sprite(mat), vel: new THREE.Vector3(), age: 0 }
      this.scene.add(p.sprite)
    }
    p.age = 0
    p.sprite.visible = true
    p.sprite.position.copy(this.origin).add(
      new THREE.Vector3((Math.random() - 0.5) * this.spread, 0, (Math.random() - 0.5) * this.spread)
    )
    p.vel.set((Math.random() - 0.5) * 0.4, this.rise * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * 0.4)
    p.sprite.material.rotation = Math.random() * Math.PI * 2
    this.parts.push(p)
  }

  update(dt) {
    this.acc += dt * this.rate
    while (this.acc >= 1) {
      this.acc -= 1
      this.spawn()
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.age += dt
      const t = p.age / this.life
      if (t >= 1) {
        p.sprite.visible = false
        this.parts.splice(i, 1)
        this.pool.push(p)
        continue
      }
      p.sprite.position.addScaledVector(p.vel, dt).addScaledVector(WIND, dt * (0.3 + t * 1.5))
      const size = this.size0 + (this.size1 - this.size0) * t
      p.sprite.scale.set(size, size, 1)
      // gyorsan megjelenik, lassan elhalványul
      p.sprite.material.opacity = this.opacity * Math.min(1, t * 8) * (1 - t)
    }
  }
}
