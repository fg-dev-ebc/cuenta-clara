import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router'
import { api, LiveRefresh, useAuth, useResource } from './client.jsx'
import { Avatar, Badge, BrandMark, currency, displayDate, Empty, goBranch, Icon, imageUrl, MessageForm, Pagination, SectionHead, Status } from './ui.jsx'
import './directory-motion.css'
import { TextGenerate } from './motion-ui.jsx'
import './editorial.css'

function SearchBar({ initial = '', onSearch, hero = false }) {
  return <form className={`search-bar ${hero ? 'search-hero' : ''}`} role="search" onSubmit={(event) => {
    event.preventDefault()
    onSearch(String(new FormData(event.currentTarget).get('q')).trim())
  }}>
    <Icon name="search" size={20} />
    <label className="sr-only" htmlFor={hero ? 'hero-search' : 'directory-search'}>Buscar restaurante, sucursal o zona</label>
    <input id={hero ? 'hero-search' : 'directory-search'} name="q" type="search" maxLength={120} placeholder="Buscar restaurante, sucursal o zona…" defaultValue={initial} />
    <button className="button button-dark">Buscar <Icon name="arrow" size={17} /></button>
  </form>
}

const layers = [
  ['Precios', 'Lo anunciado', '¿Coincidió el precio de la carta con el de la cuenta?'],
  ['Cargos', 'Los extras', '¿Hubo algún cargo que no esperabas encontrar?'],
  ['Condiciones', 'La letra chica', '¿Qué condiciones te explicaron antes de pedir?'],
]

function Receipt() {
  const [active, select] = useState(0)
  const [, title, note] = layers[active]
  return <section className="table-study" aria-label="Explora las capas de una cuenta">
    <div className="still-life">
      <div aria-hidden="true" className="table-plate"><div className="plate-engraving">
        <span className="engraving" /><b>cc.</b>
      </div></div>
      <div className="study-receipt" data-layer={active}>
        <div className="study-carbon" aria-hidden="true" />
        <div className="study-stub" aria-hidden="true" />
        <div className="study-fold" aria-hidden="true" />
        <div className="study-slip" aria-live="polite" aria-atomic="true">
          <div className="slip-mast"><BrandMark size={17} /> cuenta.clara</div>
          <div key={active} className="slip-content"><small>CAPA 0{active + 1} / 03</small><strong>{title}</strong><p>{note}</p></div>
          <span className="slip-code" aria-hidden="true" />
        </div>
      </div>
    </div>
    <div className="study-controls" role="group" aria-label="Capas de la cuenta">
      {layers.map(([label], i) => <button type="button" key={label} aria-pressed={active === i} onClick={() => select(i)}><small>0{i + 1}</small> {label}</button>)}
    </div>
  </section>
}

function CategoriesNav({ resource }) {
  return <div className="topics">
    <span className="eyebrow">EXPLORAR POR TEMA</span>
    <Status resource={resource}>
      <div className="topic-links">{resource.data?.map((category) => <Link key={category.id} to={`/establecimientos?category=${category.slug}`} className="topic-pill">{category.name}</Link>)}</div>
    </Status>
  </div>
}

function BranchImage({ id, cover = false }) {
  const [loaded, setLoaded] = useState(null)
  return <span className={cover ? 'branch-photo' : 'place-thumb'} data-card-piece="image">
    <span className="engraving" aria-hidden="true" />
    {id && <img key={id} src={imageUrl(id)} loading={cover ? 'eager' : 'lazy'} data-ready={loaded === id || undefined}
      onLoad={() => setLoaded(id)} alt={cover ? 'Fotografía aportada por la comunidad' : ''} />}
  </span>
}

export function EstablishmentCard({ item, compact = false }) {
  const navigate = useNavigate()
  const path = goBranch(item.slug)
  function openCard(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
        !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    const origin = {}
    for (const piece of event.currentTarget.querySelectorAll('[data-card-piece]')) {
      const { left, top, width } = piece.getBoundingClientRect()
      origin[piece.dataset.cardPiece] = { left, top, width }
    }
    event.preventDefault()
    navigate(path, { state: { card: item, origin } })
  }
  return <article className={`place-card ${compact ? 'place-compact' : ''}`}>
    <Link className="place-link" to={path} state={{ card: item }} onClick={openCard}>
      <div className="place-summary">
        <BranchImage id={item.image_id} />
        <div className="place-info"><h3><span data-card-piece="title">{item.name}</span></h3><p>{item.branch_name} · {item.zone}</p></div>
        <Icon name="diagonal" className="place-arrow" size={16} />
      </div>
      {!compact && <div className="place-details">
        {item.categories?.length > 0 && <div className="badges">{item.categories.map((category) => <Badge key={category}>{category}</Badge>)}</div>}
        <span className="mono">{item.review_count} {item.review_count === 1 ? 'aporte' : 'aportes'}</span>
        <span className="mono">{item.latest_review ? `Último: ${displayDate(item.latest_review)}` : 'Sin aportaciones'}</span>
      </div>}
    </Link>
  </article>
}

function Highlights({ resource }) {
  return <section className="highlights content-section" aria-label="Actividad del directorio">
    <div className="highlight-panel">
      <SectionHead number="01 / ACTIVIDAD" title="Más consultados" icon="eye" description="Las fichas más visitadas en los últimos 30 días." />
      <Status resource={resource}>
        {resource.data?.viewed.length ? <div className="highlight-list">{resource.data.viewed.map((item) => <EstablishmentCard key={item.id} item={item} compact />)}</div>
          : <Empty title="Todavía no hay consultas" description="Aquí aparecerán las fichas más visitadas." icon="eye" />}
      </Status>
    </div>
    <div className="highlight-panel">
      <SectionHead number="02 / COMUNIDAD" title="Más comentados" icon="comment" description="Las fichas con más aportaciones publicadas." />
      <Status resource={resource}>
        {resource.data?.discussed.length ? <div className="highlight-list">{resource.data.discussed.map((item) => <EstablishmentCard key={item.id} item={item} compact />)}</div>
          : <Empty title="Aún no hay comentarios" description="Las primeras aportaciones aparecerán aquí." icon="comment" />}
      </Status>
    </div>
  </section>
}

function DirectorySection({ home = false, resource, categories, filters, update }) {
  const { q, zone, category } = filters
  return <section id="directorio" className="content-section directory-section">
    {!home && <h1 className="sr-only">Explorar establecimientos</h1>}
    <SectionHead number={home ? '03 / DIRECTORIO' : 'DIRECTORIO COLABORATIVO'} title="Establecimientos" description="Encuentra información por restaurante, sucursal o zona." />
    <div className="directory-tools">
      {!home && <SearchBar key={q} initial={q ?? ''} onSearch={(value) => update({ q: value, page: null })} />}
      <label><span className="sr-only">Zona</span><select className="filter" value={zone || ''} onChange={(event) => update({ zone: event.target.value, page: null })}>
        <option value="">Todas las zonas</option>{zone && !resource.data?.zones.includes(zone) && <option value={zone}>{zone}</option>}
        {resource.data?.zones.map((value) => <option key={value}>{value}</option>)}
      </select></label>
      {!home && <label><span className="sr-only">Categoría</span><select className="filter" value={category || ''} onChange={(event) => update({ category: event.target.value, page: null })}>
        <option value="">Todas las categorías</option>{category && !categories.data?.some((item) => item.slug === category) && <option value={category}>{category}</option>}
        {categories.data?.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
      </select></label>}
    </div>
    <Status resource={resource}>
      {resource.data?.items.length
        ? <div className="place-grid">{resource.data.items.map((item) => <EstablishmentCard item={item} key={item.id} />)}</div>
        : <Empty icon="search" title={q || zone || category ? 'No encontramos coincidencias' : 'El directorio todavía está vacío'}
          description={q || zone || category ? 'Prueba otro nombre, sucursal, zona o categoría.' : 'Propón un restaurante para empezar a reunir información sobre sus sucursales.'}>
          <Link className="inline-link" to={`/solicitar-establecimiento${q ? `?q=${encodeURIComponent(q)}` : ''}`}>Proponer un establecimiento <Icon name="arrow" size={15} /></Link>
        </Empty>}
      {resource.data && <Pagination {...resource.data} onPage={(page) => update({ page })} />}
    </Status>
    {resource.data?.items.length > 0 && <p className="muted directory-note">¿No encuentras el establecimiento? <Link className="underline" to={`/solicitar-establecimiento${q ? `?q=${encodeURIComponent(q)}` : ''}`}>Solicitar un alta</Link></p>}
  </section>
}

function updateParams(current, changes) {
  const result = new URLSearchParams(current)
  for (const [key, value] of Object.entries(changes)) {
    if (value) result.set(key, String(value))
    else result.delete(key)
  }
  return result
}

export function DirectoryPage({ home = false }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(params)
  const update = (changes) => setParams(updateParams(params, changes))
  const categories = useResource('/categories')
  const resource = useResource(`/directory?${params}`)
  const highlights = useResource(home ? '/highlights' : null)
  const refresh = useCallback(() => { resource.refresh(); highlights.refresh(); categories.refresh() }, [resource.refresh, highlights.refresh, categories.refresh])

  return <div className="shell editorial">
    <LiveRefresh channel="directory" onRefresh={refresh} />
    {home && <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-marker"><span className="terminal-dot" /> GUÍA DE CAMPO / RESTAURANTES</div>
          <h1>La letra chica,<br /><em>a la vista.</em></h1>
          <p><TextGenerate>Precios, cargos y condiciones que otras personas encontraron. Consulta experiencias reales, organizadas por sucursal.</TextGenerate></p>
          <SearchBar hero onSearch={(q) => navigate(q ? `/establecimientos?q=${encodeURIComponent(q)}` : '/establecimientos')} />
        </div>
        <Receipt />
      </section>
      <div className="edition-strip"><b>CC / ARCHIVO</b><span>Experiencias por sucursal</span><a href="#directorio">Ir al índice ↓</a></div>
      <CategoriesNav resource={categories} />
      <Highlights resource={highlights} />
    </>}
    <DirectorySection home={home} resource={resource} categories={categories} filters={filters} update={update} />
  </div>
}

const detailLabels = {
  advertisedPrice: 'Precio anunciado', conditions: 'Condiciones', concept: 'Concepto',
  timing: 'Cuándo se informó', percentage: 'Porcentaje', availability: 'Disponibilidad', parkingType: 'Tipo de estacionamiento',
}
const publicViews = new Set()

export function ReviewContents({ review }) {
  const { title, description, details, amount, visited_on, currency: code } = review
  const data = [
    ...(amount != null ? [['Monto reportado', currency(amount, code), 'amount']] : []),
    ...Object.entries(details ?? {}).filter(([key]) => detailLabels[key]).map(([key, value]) => [
      detailLabels[key], key === 'advertisedPrice' ? currency(value, details.advertisedCurrency || code) : key === 'percentage' ? `${value} %` : value, key,
    ]),
  ]
  return <>
    <div className="review-layout">
      <div className="review-copy"><h3>{title}</h3><p className="review-body">{description}</p></div>
      {data.length > 0 && <dl className="review-data">{data.map(([label, value, field]) =>
        <div key={field} data-field={field}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    </div>
    <p className="mono review-meta">Visita: {displayDate(visited_on)}{review.published_at && <> · Publicación: {displayDate(review.published_at)}</>}</p>
  </>
}

function ReviewCard({ review }) {
  const [report, setReport] = useState(false)
  const { user, request } = useAuth()
  const location = useLocation()
  return <article className="review-card" id={`review-${review.id}`}>
    <div className="review-head"><Badge>{review.category}</Badge><span className="review-author"><Avatar id={review.avatar_id} alias={review.alias} />{review.alias}</span></div>
    <ReviewContents review={review} />
    {review.image_ids.length > 0 && <div className="review-images">{review.image_ids.map((id, index) => <a key={id} href={imageUrl(id)} target="_blank" rel="noreferrer" aria-label={`Abrir foto ${index + 1}`}>
      <img src={imageUrl(id)} alt={`Foto adjunta ${index + 1} de la reseña`} loading="lazy" />
    </a>)}</div>}
    {user
      ? <button className="text-button report-link" onClick={() => setReport(!report)} aria-expanded={report}>Reportar contenido</button>
      : <Link className="report-link" to="/login" state={{ from: location.pathname }}>Reportar contenido</Link>}
    {report && <MessageForm label="¿Qué deberíamos revisar?" onClose={() => setReport(false)} onSubmit={(message) => request(`/reviews/${review.id}/report`, { body: { message } })} />}
  </article>
}

function IllustrativeReviewThread({ branch }) {
  return <article className="review-card verification-demo">
    {/* <p className="eyebrow">Ejemplo ficticio · Reseña, respuesta e insignias ilustrativas</p> */}
    <header className="review-head">
      <div className="demo-signer">
        <Avatar alias="Carlos M." /><h3>Carlos M.</h3>
        <span className="verification-seal email-seal"><span aria-hidden="true">✓</span>Correo verificado</span>
      </div>
      <Badge>Higiene</Badge>
    </header>
    <p className="review-body">El pasado sábado, alrededor de las 15:30, encontré una cucaracha en mi plato de pozole. Me parece inaceptable que un establecimiento opere en estas condiciones.</p>
    <section className="demo-reply" aria-labelledby="official-reply">
      <div className="demo-signer">
        <strong>{branch.name} · {branch.branch_name}</strong>
        <span className="verification-seal branch-seal"><span aria-hidden="true">✓</span>Establecimiento verificado</span>
      </div>
      <h4 id="official-reply" className="eyebrow">Respuesta oficial del establecimiento</h4>
      <p className="review-body">Hola, Carlos. Hemos revisado las grabaciones de nuestras cámaras de seguridad correspondientes a la fecha y hora que mencionas. Las imágenes muestran que tú mismo colocaste el insecto en el plato.</p>
      <p className="review-body">Contamos con evidencia audiovisual de lo ocurrido y la hemos puesto a disposición de Cuenta Clara. Rechazamos categóricamente las afirmaciones de tu reseña.</p>
    </section>
  </article>
}

function BranchHeading({ branch, siblings = [], origin }) {
  const navigate = useNavigate()
  const header = useRef(null)
  useLayoutEffect(() => {
    if (!origin || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    const animations = []
    // Measure after the router has returned the new page to the top.
    const frame = requestAnimationFrame(() => {
      for (const piece of header.current.querySelectorAll('[data-card-piece]')) {
        const from = origin[piece.dataset.cardPiece]
        const to = piece.getBoundingClientRect()
        if (!from || !to.width || !piece.animate) continue
        const transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`
        animations.push(piece.animate([{ transform }, { transform: 'none' }], {
          duration: 330, easing: 'cubic-bezier(.2,.8,.2,1)',
        }))
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      animations.forEach(animation => animation.cancel())
    }
  }, [origin])

  return <section className="branch-header" ref={header}>
    <BranchImage cover id={branch.image_id} />
    <div>
      <span className="eyebrow">FICHA DE SUCURSAL</span>
      <h1><span data-card-piece="title">{branch.name}</span></h1>
      <p className="branch-name">{branch.branch_name} · {branch.zone}</p>
      <p className="branch-location"><Icon name="pin" /> {branch.address}</p>
      <p className="mono muted">{branch.review_count} {branch.review_count === 1 ? 'aportación' : 'aportaciones'}{branch.latest_review && ` · Última: ${displayDate(branch.latest_review)}`}</p>
      {siblings.length > 1 && <label className="branch-select">Sucursal <select value={branch.slug} onChange={(event) => navigate(goBranch(event.target.value))}>{siblings.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.zone}</option>)}</select></label>}
      <Link className="button button-dark" to={`/publicar?branch=${branch.slug}`}><Icon name="plus" size={17} /> Escribir reseña</Link>
    </div>
  </section>
}

export function BranchPage() {
  const { slug } = useParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const [params, setParams] = useSearchParams()
  const update = (changes) => setParams(updateParams(params, changes))
  const resource = useResource(`/branches/${encodeURIComponent(slug)}?${params}`)
  const selected = navigationType === 'PUSH' && location.state?.card?.slug === slug ? location.state.card : null
  const branch = resource.data?.branch ?? (resource.loading ? selected : null)

  useEffect(() => {
    if (!resource.data?.branch || publicViews.has(slug)) return
    publicViews.add(slug)
    api(`/branches/${encodeURIComponent(slug)}/views`, { method: 'POST' }).catch(() => publicViews.delete(slug))
  }, [resource.data?.branch, slug])

  return <div className="shell page-pad">
    <LiveRefresh channel={`branches/${slug}`} onRefresh={resource.refresh} />
    <Link className="breadcrumb" to="/establecimientos">← Establecimientos</Link>
    {location.state?.notice && <p className="notice print-notice" role="status">{location.state.notice}</p>}
    {branch && <BranchHeading key={slug} branch={branch} siblings={resource.data?.siblings}
      origin={selected ? location.state.origin : null} />}
    <Status resource={resource}>
      {resource.data && (() => {
        const { categories, items } = resource.data
        return <>
          <section className="content-section">
            <SectionHead number="01 / TEMAS" title="¿Qué quieres consultar?" />
            <div className="topic-links branch-topics">
              <button className="topic-pill" aria-pressed={!params.get('category')} onClick={() => update({ category: null, page: null })}>Todas <span className="mono">{branch.review_count}</span></button>
              {categories.map((item) => <button className="topic-pill" key={item.id} aria-pressed={params.get('category') === item.slug} onClick={() => update({ category: item.slug, page: null })}>{item.name} <span className="mono">{item.review_count}</span></button>)}
            </div>
          </section>
          <section className="content-section">
            <SectionHead number="02 / EXPERIENCIAS" title="Aportaciones" description="Experiencias reportadas por la comunidad; no son hechos verificados por Cuenta Clara." />
            <form className="date-filters" key={`${params.get('from')}-${params.get('to')}`} onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              update({ from: form.get('from'), to: form.get('to'), page: null })
            }}>
              <label>Fecha de visita desde <input type="date" name="from" defaultValue={params.get('from') ?? ''} /></label>
              <label>Hasta <input type="date" name="to" defaultValue={params.get('to') ?? ''} /></label>
              <button className="button button-outline">Filtrar</button>
              {(params.get('from') || params.get('to')) && <button type="button" className="text-button" onClick={() => update({ from: null, to: null, page: null })}>Quitar fechas</button>}
            </form>
            {items.length ? <div className="reviews">{items.map((review) => <ReviewCard key={review.id} review={review} />)}</div>
              : <Empty description="No hay aportaciones para la selección actual. Esto no indica que no existan cargos o condiciones." />}
            <Pagination {...resource.data} onPage={(page) => update({ page })} />
            {branch.slug === 'la-casa-de-tono-zona-rosa-49dfffb5' && !params.size &&
              <IllustrativeReviewThread branch={branch} />}
          </section>
        </>
      })()}
    </Status>
  </div>
}
