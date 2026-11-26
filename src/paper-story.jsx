import { useEffect, useRef, useState } from 'react'

const stages = ['roll', 'ticket', 'loop', 'stack', 'cut', 'filed']

function printStyle(stage) {
  const plate = stage === 'cut' ? 'stack' : stage
  return { '--paper-print': `url("/assets/paper/${plate}.webp")` }
}

export function PaperPrint({ stage }) {
  return <div aria-hidden="true" className="paper-frame paper-inline" style={printStyle(stage)} />
}

function PaperCanvas({ stage }) {
  const canvas = useRef(null)
  const scene = useRef(null)
  const current = useRef(stage)
  useEffect(() => {
    current.current = stage
    scene.current?.select(stage)
  }, [stage])

  useEffect(() => {
    const surface = canvas.current
    let visible = false
    let loading = false
    let stopped = false
    function loseContext() {
      stopped = true
      delete surface.dataset.ready
    }
    const observer = new IntersectionObserver(async ([entry]) => {
      visible = entry.isIntersecting
      if (stopped) return
      if (scene.current) {
        scene.current.setVisible(visible)
      } else if (visible && !loading) {
        loading = true
        try {
          const { mountPaper } = await import('./paper-scene.js')
          if (stopped || !visible) return
          scene.current = mountPaper(surface, current.current)
          surface.dataset.ready = ''
        } catch {
          // The printed plate is already in place if WebGL or its chunk is unavailable.
          loseContext()
        } finally {
          loading = false
        }
      }
    })
    observer.observe(surface)
    surface.addEventListener('webglcontextlost', loseContext)
    return () => {
      stopped = true
      observer.disconnect()
      surface.removeEventListener('webglcontextlost', loseContext)
      scene.current?.dispose()
      scene.current = null
      delete surface.dataset.ready
    }
  }, [])
  return <canvas ref={canvas} />
}

export function PaperMargin({ text }) {
  const [stage, setStage] = useState('roll')
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 820px)')
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const anchors = [...text.current.querySelectorAll('[data-paper-stage]')]
    let frame = 0
    function readStage() {
      frame = 0
      const line = window.innerHeight * .5
      let active = 'roll'
      for (const paragraph of anchors) {
        if (paragraph.getBoundingClientRect().top > line) break
        active = paragraph.dataset.paperStage
      }
      setStage(active)
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(readStage)
    }
    function layout() {
      setAnimated(wide.matches && motion.matches && 'IntersectionObserver' in window && 'ResizeObserver' in window)
      if (wide.matches) {
        window.addEventListener('scroll', onScroll, { passive: true })
        readStage()
      } else {
        window.removeEventListener('scroll', onScroll)
      }
    }
    layout()
    window.addEventListener('resize', layout)
    motion.addEventListener('change', layout)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', layout)
      motion.removeEventListener('change', layout)
    }
  }, [text])
  return <div aria-hidden="true" className="paper-frame paper-margin" data-stage={stage} style={printStyle(stage)}>
    {animated && <PaperCanvas stage={stage} />}
    <div className="paper-register">{stages.map(name => <i key={name} data-current={stage === name || undefined} />)}</div>
  </div>
}
