import { useEffect, useRef, useState } from 'react'
import { PageHeading } from './ui.jsx'
import './pitch.css'

const opening = '¿Cuántas veces hemos consultado las reseñas de un establecimiento y aun así, nos hemos quedado con dudas?'
const paragraphs = [
  'Un restaurante puede tener 4.8 estrellas, pero ¿la propina es obligatoria?, ¿cuenta con estacionamiento propio o tienes que pagar por estacionarte en la vía pública?',
  'Un bar puede tener excelentes comentarios, pero ¿cobra entrada?, ¿cuánto cuesta?, ¿te informan de ese cargo antes de ingresar?',
  'Un gimnasio puede tener buenas instalaciones, pero ¿cobra penalizaciones por cancelar?, ¿existen cargos de mantenimiento?, ¿es fácil dar de baja la membresía?',
  'Actualmente, para responder estas preguntas, tenemos que navegar entre decenas o incluso cientos de reseñas, sin garantía de encontrar la información que buscamos.',
  '"El problema es que la información no está segmentada"',
  'Y así nace Cuenta Clara, una plataforma colaborativa que permite consultar y compartir reseñas organizadas por tema, transformando las experiencias individuales en información útil y estructurada.',
  'Nuestra visión es convertirnos en el referente de consulta para las decisiones de consumo.',
  'Porque una calificación te dice qué tan satisfechos estuvieron los demás, pero Cuenta Clara te ayuda a saber qué esperar tú.',
]

export function PitchPage() {
  const text = useRef(null)
  const [phase, setPhase] = useState(() => (
    typeof IntersectionObserver === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
      ? 'waiting' : 'complete'
  ))
  const [visibleCharacters, setVisibleCharacters] = useState(0)

  useEffect(() => {
    if (phase !== 'waiting') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPhase(current => current === 'waiting' ? 'typing' : current)
    })
    observer.observe(text.current)
    return () => observer.disconnect()
  }, [phase])

  useEffect(() => {
    if (phase !== 'typing') return
    let count = 0
    const timer = window.setInterval(() => {
      count += 1
      setVisibleCharacters(count)
      if (count === opening.length) {
        window.clearInterval(timer)
        setPhase('revealing')
      }
    }, 16)
    return () => window.clearInterval(timer)
  }, [phase])

  return <article className="shell reading page-pad">
    <PageHeading label="CUENTA CLARA" title="Video promocional" />
    <video controls playsInline preload="metadata" className="w-full" aria-label="Video promocional de Cuenta Clara">
      <source src="/assets/pitch-hackathon.mp4" type="video/mp4" />
      <a href="/assets/pitch-hackathon.mp4">Abrir el video</a>
    </video>
    <section className="pitch" aria-labelledby="pitch-title">
      <h2 id="pitch-title" className="pitch-heading">El pitch de Cuenta Clara</h2>
      <div className="pitch-text" data-phase={phase} ref={text}>
        <p className="pitch-opening">
          <strong className="pitch-opening-full">{opening}</strong>
          {phase === 'typing' && <strong className="pitch-typing" aria-hidden="true">
            {opening.slice(0, visibleCharacters)}
          </strong>}
        </p>
        {paragraphs.map((paragraph, index) => (
          <p key={paragraph} style={{ '--pitch-delay': `${index * 230}ms` }}>
            {index === 4 || index === paragraphs.length - 1 ? <strong>{paragraph}</strong> : paragraph}
          </p>
        ))}
      </div>
    </section>
  </article>
}
