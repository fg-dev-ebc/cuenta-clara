import {
  AmbientLight, BasicShadowMap, CanvasTexture, DirectionalLight, DoubleSide, Euler,
  Float32BufferAttribute, Mesh, MeshStandardMaterial, OrthographicCamera, PlaneGeometry,
  Scene, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'

const poses = ['roll', 'ticket', 'loop', 'stack', 'filed']
const turn = Math.PI * 2

// Three adjoining lengths of the same perforated strip. Coordinates are in paper widths.
function paperPoint(pose, panel, u, t) {
  const along = (panel + t) / 3
  const across = u - .5
  let point
  let tilt
  switch (pose) {
    case 'roll': {
      const wound = Math.min(along / .75, 1)
      const angle = .2 + wound * turn * 1.25
      const radius = .34 + .55 * wound
      const tail = Math.max(along - .75, 0) * 6
      point = [across * 1.95, .53 + radius * Math.cos(angle) - tail, radius * Math.sin(angle) - tail * .2]
      tilt = [-.13, -.78, -.2]
      break
    }
    case 'ticket': {
      const stub = Math.max(along * 3 - 2, 0)
      point = [across * 2, 1.68 - 3.5 * along + stub * .44, .09 * Math.sin(along * Math.PI) + stub * .98]
      tilt = [.18, -.42, -.24]
      break
    }
    case 'loop': {
      const angle = (.03 + along * 1.03) * turn
      point = [across * 1.24 + (along - .5) * 1.25, 1.27 * Math.cos(angle), .94 * Math.sin(angle)]
      tilt = [-.3, -.8, .37]
      break
    }
    case 'stack': {
      const crease = Math.abs(t * 2 - 1)
      point = [across * 1.53, 1.26 - 2.52 * t, crease * .48]
      tilt = [.12, -.28, [.65, -.53, -.14][panel]]
      break
    }
    case 'filed':
      point = [(panel - 1) * 1.22 + across * 1.05, 1.22 - 2.44 * t, .12 * t * t]
      tilt = [.08, -.08, 0]
      break
  }
  const vertex = new Vector3(...point).applyEuler(new Euler(...tilt))
  if (pose === 'stack') {
    vertex.x += (panel - 1) * .46
    vertex.y -= (panel - 1) * .23
    vertex.z += panel * .32
  }
  return vertex
}

function printedPaper(panel) {
  const sheet = document.createElement('canvas')
  sheet.width = 384
  sheet.height = 512
  const ctx = sheet.getContext('2d')
  ctx.fillStyle = ['#fff4de', '#f9ead3', '#fff8e6'][panel]
  ctx.fillRect(0, 0, 384, 512)
  ctx.fillStyle = '#382430'
  // Registration symbol, ruling and machine marks; the actual copy stays in the DOM.
  ctx.fillRect(34, 40, 56, 9)
  if (panel === 0) ctx.fillRect(34, 57, 56, 9)
  if (panel === 1) ctx.fillRect(57, 18, 10, 54)
  if (panel === 2) {
    ctx.beginPath()
    ctx.moveTo(34, 40)
    ctx.lineTo(90, 40)
    ctx.lineTo(90, 83)
    ctx.fill()
  }
  for (let x = 278; x < 350; x += 12) ctx.fillRect(x, 39, 6, 20)
  ctx.fillRect(34, 93, 316, 4)
  ctx.strokeStyle = '#8e6571'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 19; i++) {
    ctx.beginPath()
    ctx.ellipse(192, 177, 105, 23, (i - 9) * .057, 0, turn)
    ctx.stroke()
  }
  for (let i = 0; i < 5; i++) {
    const y = 262 + 21 * i
    ctx.fillRect(34, y, 74 + (i * 37 + panel * 13) % 93, 4)
    ctx.fillRect(297 + i % 3 * 7, y, 53 - i % 3 * 7, 4)
  }
  for (let x = 34; x < 350; x += 12) ctx.fillRect(x, 386, 6, 2)
  for (let x = 34, i = 0; x < 200; i++) {
    const width = [3, 7, 2, 2, 5, 4, 2][i % 7]
    ctx.fillRect(x, 414, width, 38)
    x += width + 3
  }
  // Actual holes let the dark ground and the other layers show through.
  for (let x = 4; x < 384; x += 16) ctx.clearRect(x, 503, 7, 4)
  for (let y = 16; y < 512; y += 32) {
    ctx.clearRect(5, y, 7, 8)
    ctx.clearRect(372, y, 7, 8)
  }
  const texture = new CanvasTexture(sheet)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function paperPanel(panel) {
  const shapes = poses.map(pose => {
    const shape = new PlaneGeometry(1, 1, 1, 48)
    const { position, uv } = shape.attributes
    for (let i = 0; i < position.count; i++) {
      const p = paperPoint(pose, panel, uv.getX(i), 1 - uv.getY(i))
      position.setXYZ(i, p.x, p.y, p.z)
    }
    shape.computeVertexNormals()
    return shape
  })
  const geometry = shapes[0]
  for (const key of ['position', 'normal']) {
    geometry.morphAttributes[key] = shapes.map(shape =>
      new Float32BufferAttribute(shape.attributes[key].array, 3))
  }
  const material = new MeshStandardMaterial({
    map: printedPaper(panel), side: DoubleSide, roughness: 1, alphaTest: .5,
  })
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

export function mountPaper(canvas, initialStage) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = BasicShadowMap
  const scene = new Scene()
  const camera = new OrthographicCamera(-2.3, 2.3, 2.3, -2.3, .1, 20)
  camera.position.z = 8
  const panels = [0, 1, 2].map(paperPanel)
  const ground = new Mesh(new PlaneGeometry(18, 18), new ShadowMaterial({ color: 0x120b13, opacity: .55 }))
  ground.position.z = -1.2
  ground.receiveShadow = true
  const key = new DirectionalLight(0xfff0e6, 2)
  key.position.set(-3, 4, 8)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -.0004
  scene.add(...panels, ground, key, new AmbientLight(0xffe8ed, 1.45))

  let frame = 0
  let visible = true
  let target
  const weights = poses.map(() => 0)
  function draw() {
    for (const panel of panels) {
      for (let i = 0; i < weights.length; i++) panel.morphTargetInfluences[i] = weights[i]
    }
    renderer.render(scene, camera)
  }
  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    renderer.setSize(width, height, false)
    const aspect = width / height
    camera.top = 2.16 * Math.max(1, 1 / aspect)
    camera.bottom = -camera.top
    camera.right = camera.top * aspect
    camera.left = -camera.right
    camera.updateProjectionMatrix()
    if (visible) draw()
  }
  function select(stage, immediate = false) {
    const next = poses.indexOf(stage === 'cut' ? 'stack' : stage)
    if (next === target && !immediate) return
    target = next
    cancelAnimationFrame(frame)
    const start = weights.slice()
    const since = performance.now()
    function step(now) {
      const progress = immediate || !visible ? 1 : Math.min(1, (now - since) / 440)
      const remaining = (1 - progress) ** 3
      for (let i = 0; i < weights.length; i++) {
        const end = Number(i === target)
        weights[i] = end + (start[i] - end) * remaining
      }
      if (visible) draw()
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    step(since)
  }
  select(initialStage, true)
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  return {
    select,
    setVisible(value) {
      visible = value
      select(poses[target], true)
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const mesh of [...panels, ground]) {
        mesh.geometry.dispose()
        mesh.material.map?.dispose()
        mesh.material.dispose()
      }
      key.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
