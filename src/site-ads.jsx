import { useEffect, useRef, useState } from 'react'
import './site-ads.css'

const styles = [
  { colors: ['#ff674c', '#211412', '#fff5a1'], model: 'can', glyph: '✹' },
  { colors: ['#d0afff', '#241733', '#f8ebff'], model: 'ticket', glyph: '◈' },
  { colors: ['#fbe5c5', '#281c24', '#fa847a'], model: 'bolt', glyph: 'ϟ' },
  { colors: ['#dafa4e', '#1a2513', '#fff6bc'], model: 'record', glyph: '◎' },
  { colors: ['#ffaad5', '#321735', '#ffe9f9'], model: 'record', glyph: '◉' },
  { colors: ['#ffc557', '#332011', '#fff0cd'], model: 'can', glyph: '✸' },
  { colors: ['#7de8fb', '#132638', '#dcfdff'], model: 'bolt', glyph: 'ϟ' },
  { colors: ['#ff995f', '#301521', '#ffecba'], model: 'ticket', glyph: '▤' },
  { colors: ['#b4ffd6', '#123128', '#f2ffcf'], model: 'ticket', glyph: '▧' },
]

const campaigns = [
  ['Carne de autor', 'Cultiva tu propia carne humana y descubre a qué sabes.', 'GOURMET / BIO'],
  ['Hijo Premium', 'Sustituye a tu hijo por una versión genéticamente superior.', 'FAMILIA / PLUS'],
  ['Esclavitud sintética', 'Conciencias artificiales capaces de sufrir, diseñadas para obedecer eternamente.', 'SINTÉTICO / 24H'],
  ['Reencarnación inmediata', 'Transfiere tu conciencia al cuerpo de un recién nacido.', 'RENUEVA / HOY'],
  ['Dios de bolsillo', 'Una inteligencia artificial crea universos conscientes para tu entretenimiento.', 'COSMOS / MINI'],
  ['Clon de emergencia', 'Mantén una copia consciente de ti mismo para extraer órganos cuando los necesites.', 'REPUESTO / VITAL'],
  ['Muerte compartida', 'Experimenta los últimos segundos de vida de personas fallecidas.', 'ÚLTIMA / SEÑAL'],
  ['El útero industrial', 'Fábricas de seres humanos especializados para trabajos específicos.', 'FÁBRICA / 24H'],
  ['Infierno personalizado', 'Encierra la conciencia de tus enemigos en una simulación eterna.', 'SIMULACIÓN / ∞'],
  ['Padres desechables', 'Adquiere padres artificiales y reemplázalos cuando dejen de satisfacerte.', 'FAMILIA / FLEX'],
  ['Inmortalidad obligatoria', 'Un seguro médico que te impide morir, independientemente de tu sufrimiento.', 'COBERTURA / ∞'],
  ['Alquila tu cadáver', 'Financia tu vida permitiendo que otros utilicen tu cuerpo después de morir.', 'RENTA / POST'],
  ['El último humano', 'Visita al último ser humano no modificado genéticamente en cautiverio.', 'EXHIBICIÓN / 01'],
  ['Conciencia colectiva', 'Elimina tu individualidad y conviértete en parte de una mente corporativa.', 'MENTE / RED'],
  ['Bebés corporativos', 'Recibe un hijo gratuitamente a cambio de ceder sus derechos laborales futuros.', 'CONTRATO / 00'],
  ['Recuerdos de segunda mano', 'Compra infancias felices extraídas de personas económicamente vulnerables.', 'MEMORIA / USADA'],
  ['Dios como servicio', 'Contrata una entidad extradimensional para intervenir en tu realidad.', 'DIVINO / SaaS'],
  ['Mascotas humanas', 'Humanos modificados genéticamente para desarrollar dependencia emocional absoluta.', 'AFECTO / TOTAL'],
  ['Nutrición ancestral', 'Convierte los restos de tus familiares en suplementos alimenticios personalizados.', 'FÓRMULA / RAÍZ'],
  ['Embarazo interestelar', 'Gesta organismos extraterrestres a cambio de beneficios económicos.', 'GESTA / ÓRBITA'],
  ['El empleado eterno', 'Digitaliza a tus trabajadores para que continúen produciendo después de morir.', 'TURNO / ∞'],
  ['Universos desechables', 'Crea civilizaciones enteras y destrúyelas cuando te aburras.', 'COSMOS / EXPRESS'],
  ['Segunda piel', 'Habita el cuerpo de otra persona mientras su conciencia permanece atrapada dentro.', 'CUERPO / ALTER'],
  ['Adopta una deidad', 'Cría una entidad cósmica desde su etapa embrionaria.', 'CRIANZA / CÓSMICA'],
  ['Dolor como servicio', 'Transfiere tus enfermedades y sufrimiento físico a otra persona.', 'DOLOR / OFF'],
  ['Abuela 2.0', 'Resucita digitalmente a tus familiares y modifica sus personalidades.', 'FAMILIA / 2.0'],
  ['Humanos de temporada', 'Colecciones limitadas de cuerpos humanos diseñados según las tendencias del año.', 'COLECCIÓN / LIMITADA'],
  ['El mercado de almas', 'Comercializa tu conciencia a cambio de prosperidad económica.', 'ALMA / BOLSA'],
  ['Vacaciones de existencia', 'Permite que una IA controle tu cuerpo mientras suspendes tu conciencia.', 'PAUSA / VITAL'],
  ['Tu peor versión', 'Crea un clon que experimente todas las consecuencias de tus malas decisiones.', 'CLON / BETA'],
  ['Extinción asistida', 'Un servicio corporativo para civilizaciones que desean dejar de existir.', 'CIERRE / TOTAL'],
  ['El otro lado', 'Transmite en directo desde una dimensión donde la muerte no existe.', 'EN VIVO / ∞'],
  ['Democracia neuronal', 'Una IA modifica los pensamientos de la población para eliminar el desacuerdo.', 'CONSENSO / 100%'],
  ['Descendencia infinita', 'Una empresa utiliza tu ADN para poblar planetas sin tu participación.', 'LINAJE / ESTELAR'],
  ['El consumidor perfecto', 'Implantes cerebrales que convierten la publicidad en deseos biológicos.', 'COMPRA / REFLEJO'],
  ['Realidad de prueba', 'Descubre si tu universo es una simulación y contrata una versión superior.', 'REALIDAD / PRO'],
  ['Silencio mental', 'Elimina permanentemente tu capacidad de pensar sin afectar tu productividad.', 'MENTE / MUTE'],
  ['El rostro de Dios', 'Observa una entidad cuya apariencia altera irreversiblemente la mente humana.', 'VISIÓN / ÚNICA'],
  ['Después del universo', 'Reserva un espacio para tu conciencia cuando desaparezca la última estrella.', 'RESERVA / FINAL'],
  ['Humanidad Legacy', 'Servicio de migración para abandonar definitivamente la especie humana.', 'MIGRACIÓN / LEGACY'],
].map(([name, line, tag], index) => ({ name, line, tag, ...styles[index % styles.length] }))

const placements = [3900, 5400, 6900, 4700, 6100, 7600]
const frameInterval = 1000 / 30
const campaignAt = (index, rotation) => (index * 7 + rotation * 13) % campaigns.length

function AdSlot({ index, rotation }) {
  const campaign = campaigns[campaignAt(index, rotation)]
  const [background, ink, accent] = campaign.colors

  return <section
    className="pitch-ad"
    data-ad-slot={index}
    data-ad-model={campaign.model}
    style={{ '--ad-bg': background, '--ad-ink': ink, '--ad-accent': accent }}
    aria-label={`Anuncio: ${campaign.name}`}
  >
    <header className="pitch-ad-label"><b>ADS</b><span>PUBLICIDAD</span><span>{String(index + 1).padStart(2, '0')}</span></header>
    <div className="pitch-ad-art" aria-hidden="true">
      <span className="pitch-ad-cross">+</span>
      <span className="pitch-ad-glyph" key={campaign.name}>{campaign.glyph}</span>
      <canvas className="pitch-ad-canvas" width="320" height="320" />
    </div>
    <div className="pitch-ad-creative" key={campaign.name}>
      <div className="pitch-ad-copy">
        <h3>{campaign.name}</h3>
        <p>{campaign.line}</p>
      </div>
      <div className="pitch-ad-ticker" aria-hidden="true">
        <span>{campaign.tag} ✦ {campaign.tag} ✦&nbsp;</span>
        <span>{campaign.tag} ✦ {campaign.tag} ✦&nbsp;</span>
      </div>
    </div>
    <div className="pitch-ad-progress" aria-hidden="true" />
  </section>
}

export function SiteAds({ children }) {
  const layout = useRef(null)
  const playback = useRef(null)
  const [paused, setPaused] = useState(false)
  const [rows, setRows] = useState(3)
  const [rotations, setRotations] = useState({})

  useEffect(() => {
    if (!('ResizeObserver' in window)) return
    const surface = layout.current
    const rail = surface.querySelector('.pitch-ad-rail-left')
    const wide = window.matchMedia('(min-width: 1050px)')
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.contentRect.height
      setRows(wide.matches ? Math.max(2, Math.round((height - 38) / (rail.clientWidth * .57 + 137))) : 3)
    })
    observer.observe(surface)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return

    const surface = layout.current
    surface.setAttribute('data-ad-controls', '')
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const slots = new Map()
    let scene
    let loading = false
    let stopped = false
    let manuallyPaused = false
    let frame = 0
    let lastTime = 0

    function animate(time) {
      frame = requestAnimationFrame(animate)
      const delta = lastTime ? time - lastTime : 0
      if (lastTime && delta < frameInterval - 1) return
      lastTime = time
      let changed = false
      for (const slot of slots.values()) {
        if (!slot.visible) continue
        slot.elapsed += delta
        const rotation = Math.floor(slot.elapsed / slot.duration)
        if (rotation !== slot.rotation) {
          slot.rotation = rotation
          changed = true
        }
        const progress = slot.elapsed % slot.duration / slot.duration
        slot.element.style.setProperty('--ad-progress', progress)
        if (scene) {
          const campaign = campaignAt(slot.index, rotation)
          slot.canvas.toggleAttribute('data-ready', scene.draw(slot.canvas, campaign, slot.elapsed / 1000, progress, slot.index))
        }
      }
      if (changed) setRotations(Object.fromEntries([...slots.values()].map(slot => [slot.index, slot.rotation])))
    }

    function syncPlayback() {
      const enabled = motion.matches && !manuallyPaused && !document.hidden
      const running = enabled && [...slots.values()].some(slot => slot.visible)
      for (const slot of slots.values()) {
        slot.element.toggleAttribute('data-running', enabled && slot.visible)
        if (!motion.matches) slot.canvas.removeAttribute('data-ready')
      }
      if (running && !frame) frame = requestAnimationFrame(animate)
      if (!running) {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0
      }
      if (running && !loading) {
        loading = true
        import('./site-ad-scene.js').then(({ mountAdStudio }) => {
          if (!stopped) scene = mountAdStudio(campaigns)
        }).catch(() => {
          // The printed artwork and campaign rotation also work without WebGL.
        })
      }
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const slot = slots.get(entry.target)
        if (slot) slot.visible = entry.isIntersecting
      }
      syncPlayback()
    })
    motion.addEventListener('change', syncPlayback)
    document.addEventListener('visibilitychange', syncPlayback)
    playback.current = {
      pause(value) {
        manuallyPaused = value
        syncPlayback()
      },
      syncSlots() {
        let removed = false
        for (const element of slots.keys()) {
          if (surface.contains(element)) continue
          removed = true
          observer.unobserve(element)
          slots.delete(element)
        }
        if (removed) setRotations(Object.fromEntries([...slots.values()].map(slot => [slot.index, slot.rotation])))
        for (const element of surface.querySelectorAll('[data-ad-slot]')) {
          if (slots.has(element)) continue
          const index = Number(element.dataset.adSlot)
          const duration = placements[index % placements.length]
          slots.set(element, {
            element, index, canvas: element.querySelector('canvas'), visible: false,
            elapsed: 0, rotation: 0, duration,
          })
          observer.observe(element)
        }
        syncPlayback()
      },
    }

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      motion.removeEventListener('change', syncPlayback)
      document.removeEventListener('visibilitychange', syncPlayback)
      scene?.dispose()
      surface.removeAttribute('data-ad-controls')
      playback.current = null
    }
  }, [])

  useEffect(() => { playback.current?.syncSlots() }, [rows])
  useEffect(() => { playback.current?.pause(paused) }, [paused])

  function renderRail(side) {
    return Array.from({ length: rows }, (_, row) => {
      const index = row * 2 + side
      return <AdSlot key={index} index={index} rotation={rotations[index] ?? 0} />
    })
  }

  return <div className="site-ad-layout" ref={layout}>
    <div className="site-ad-main">{children}</div>
    <aside className="pitch-ad-rail pitch-ad-rail-left" aria-label="Anuncios, primer bloque">
      <div className="pitch-ad-rail-label">
        <span>ESPACIO ADS</span>
        <button className="pitch-ad-pause" type="button" aria-label="Pausar anuncios" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          <span aria-hidden="true">{paused ? '▶ Reanudar' : 'Ⅱ Pausar'}</span>
        </button>
      </div>
      {renderRail(0)}
    </aside>
    <aside className="pitch-ad-rail pitch-ad-rail-right" aria-label="Anuncios, segundo bloque">
      <div className="pitch-ad-rail-label"><span>ESPACIO ADS</span><b>PUBLICIDAD</b></div>
      {renderRail(1)}
    </aside>
  </div>
}
