import {
  AmbientLight, BoxGeometry, CanvasTexture, CylinderGeometry, DirectionalLight,
  ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, Shape, SRGBColorSpace, TorusGeometry, WebGLRenderer,
} from 'three'

function printLabel(campaign, number) {
  const art = document.createElement('canvas')
  art.width = 512
  art.height = 256
  const ctx = art.getContext('2d')
  const [background, ink, accent] = campaign.colors
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = ink
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, 492, 236)
  ctx.fillStyle = background
  ctx.fillRect(18, 18, 476, 45)
  ctx.fillStyle = ink
  ctx.font = 'bold 25px monospace'
  ctx.fillText(`ADS / EDICIÓN ${String(number).padStart(2, '0')}`, 30, 50)
  ctx.font = '900 58px system-ui, sans-serif'
  ctx.fillText(campaign.name, 27, 141, 458)
  ctx.font = 'bold 22px monospace'
  ctx.fillText(campaign.tag, 29, 180)
  for (let x = 30; x < 478; x += 9) ctx.fillRect(x, 202, x % 4 + 2, 24)
  const texture = new CanvasTexture(art)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function buildProduct(campaign, index) {
  const [background, ink, accent] = campaign.colors
  const product = new Group()
  const dark = new MeshStandardMaterial({ color: ink, roughness: .55 })
  const light = new MeshStandardMaterial({ color: accent, roughness: .52 })
  const color = new MeshStandardMaterial({ color: background, roughness: .38 })
  const print = new MeshStandardMaterial({ map: printLabel(campaign, index + 1), roughness: .65 })

  function add(geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    product.add(mesh)
    return mesh
  }

  switch (campaign.model) {
    case 'can':
      add(new CylinderGeometry(.59, .61, 1.75, 48), [print, light, dark])
      for (const y of [-.86, .86]) add(new CylinderGeometry(.61, .61, .09, 40), dark, 0, y)
      add(new BoxGeometry(.15, .06, .34), light, 0, .93)
      break
    case 'ticket':
      for (let layer = 0; layer < 3; layer++) {
        add(new BoxGeometry(1.8, 1.12, .09), layer === 2 ? dark : color, -.12 * (2 - layer), -.15 * (2 - layer), .13 * layer)
          .rotation.z = .16 * (2 - layer)
      }
      add(new PlaneGeometry(1.74, 1.06), print, 0, 0, .31)
      break
    case 'record':
      add(new CylinderGeometry(.88, .88, .13, 48), dark).rotation.x = Math.PI / 2
      for (const radius of [.48, .62, .76]) add(new TorusGeometry(radius, .017, 8, 48), color, 0, 0, .072)
      add(new CylinderGeometry(.39, .39, .02, 32), light, 0, 0, .08).rotation.x = Math.PI / 2
      add(new PlaneGeometry(.62, .31), print, 0, 0, .094)
      break
    case 'bolt': {
      const shape = new Shape()
      shape.moveTo(.15, .98)
      shape.lineTo(-.62, -.09)
      shape.lineTo(-.05, -.09)
      shape.lineTo(-.28, -.98)
      shape.lineTo(.65, .28)
      shape.lineTo(.07, .28)
      shape.closePath()
      add(new ExtrudeGeometry(shape, { depth: .23, bevelThickness: .055, bevelSize: .055, bevelSegments: 2 }), [light, color], 0, 0, -.12)
      add(new TorusGeometry(.99, .045, 8, 48), dark)
      add(new PlaneGeometry(.62, .31), print, .35, -.65, .21)
      break
    }
  }
  return { product, materials: [dark, light, color, print], texture: print.map }
}

export function mountAdStudio(campaigns) {
  const surface = document.createElement('canvas')
  const renderer = new WebGLRenderer({ canvas: surface, alpha: true, antialias: true })
  renderer.setSize(320, 320, false)
  const scene = new Scene()
  const camera = new PerspectiveCamera(34, 1, .1, 20)
  camera.position.z = 5.1
  const spotlight = new DirectionalLight(0xfff0df, 2.7)
  spotlight.position.set(2, 4, 5)
  scene.add(spotlight, new AmbientLight(0xfde7ff, 1.25))
  const products = new Map()
  const contexts = new WeakMap()

  return {
    draw(canvas, campaign, time, progress, index) {
      if (renderer.getContext().isContextLost()) return false
      if (!contexts.has(canvas)) contexts.set(canvas, canvas.getContext('2d'))
      const context = contexts.get(canvas)
      if (!context) return false
      if (!products.has(campaign)) products.set(campaign, buildProduct(campaigns[campaign], campaign))
      const { product } = products.get(campaign)
      const beat = time * (3.2 + index % 6 * .28) + index * 1.3
      const enter = Math.max(0, 1 - progress * 8) ** 2
      const leave = Math.max(0, progress * 8 - 7) ** 2
      product.rotation.set(Math.sin(beat * .84) * .45, beat + enter * 3.4, Math.cos(beat * 1.13) * .4)
      product.position.set(enter * 1.08 - leave * .9 + Math.sin(beat) * .18, Math.sin(beat * 1.72) * .24, Math.cos(beat * 1.35) * .5)
      product.scale.setScalar(1.11 - enter * .55 - leave * .42)
      scene.add(product)
      renderer.render(scene, camera)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(surface, 0, 0)
      scene.remove(product)
      return true
    },
    dispose() {
      for (const { product, materials, texture } of products.values()) {
        for (const mesh of product.children) mesh.geometry.dispose()
        for (const material of materials) material.dispose()
        texture.dispose()
      }
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
