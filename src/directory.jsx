import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, LiveRefresh, useAuth, useResource } from './client.jsx'
import { Avatar, Badge, currency, displayDate, Empty, goBranch, Icon, imageUrl, MessageForm, Pagination, SectionHead, Status } from './ui.jsx'

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

function Receipt() {
  return <div className="receipt-canvas" aria-hidden="true">
    <span className="canvas-caption eyebrow">FIG. 01 / LA CUENTA</span>
    <span className="canvas-cross a">+</span><span className="canvas-cross b">+</span>
    <div className="receipt">
      <div className="receipt-icon"><Icon name="logo" size={24} /></div>
      <strong>cuenta.clara</strong>
      <span className="receipt-sub">ANTES DE IR</span>
      <div className="receipt-rule" />
      <div className="receipt-rows">
        <span>01 / PRECIOS</span><span>···</span>
        <span>02 / CONDICIONES</span><span>···</span>
        <span>03 / CONTEXTO</span><span>···</span>
      </div>
      <div className="receipt-rule" />
      <div className="receipt-bottom"><span>INFORMACIÓN</span><span className="barcode" /></div>
    </div>
    <span className="canvas-footer">DATOS, NO ESTRELLAS.</span>
  </div>
}

function CategoriesNav({ resource }) {
  return <div className="topics">
    <span className="eyebrow">EXPLORAR POR TEMA</span>
    <Status resource={resource}>
      <div className="topic-links">{resource.data?.map((category) => <Link key={category.id} to={`/establecimientos?category=${category.slug}`} className="topic-pill">{category.name}</Link>)}</div>
    </Status>
  </div>
}

export function EstablishmentCard({ item, compact = false }) {
  return <article className={`place-card ${compact ? 'place-compact' : ''}`}>
    <Link className="place-link" to={goBranch(item.slug)}>
      <span className="place-thumb">{item.image_id ? <img loading="lazy" src={imageUrl(item.image_id)} alt="" /> : <Icon name="fork" size={23} />}</span>
      <div className="place-info"><h3>{item.name}</h3><p>{item.branch_name} · {item.zone}</p></div>
      <Icon name="diagonal" className="place-arrow" size={16} />
    </Link>
    {!compact && <div className="place-details">
      <span className="mono">{item.review_count} {item.review_count === 1 ? 'aporte' : 'aportes'}</span>
      <span className="mono">{item.latest_review ? `Último: ${displayDate(item.latest_review)}` : 'Sin aportaciones'}</span>
      {item.categories?.length > 0 && <div className="badges">{item.categories.map((category) => <Badge key={category}>{category}</Badge>)}</div>}
    </div>}
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

  return <div className="shell">
    <LiveRefresh channel="directory" onRefresh={refresh} />
    {home && <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-marker"><span className="terminal-dot" /> DIRECTORIO DE EXPERIENCIAS</div>
          <h1>Información clara.<br /><span>Antes de ir.</span></h1>
          <p>Precios, cargos y condiciones que otras personas encontraron. Consulta experiencias reales, organizadas por sucursal.</p>
          <SearchBar hero onSearch={(q) => navigate(q ? `/establecimientos?q=${encodeURIComponent(q)}` : '/establecimientos')} />
        </div>
        <Receipt />
      </section>
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
    ...(amount != null ? [['Monto reportado', currency(amount, code)]] : []),
    ...Object.entries(details ?? {}).filter(([key]) => detailLabels[key]).map(([key, value]) => [
      detailLabels[key], key === 'advertisedPrice' ? currency(value, details.advertisedCurrency || code) : key === 'percentage' ? `${value} %` : value,
    ]),
  ]
  return <><h3>{title}</h3>
    <p className="review-body">{description}</p>
    {data.length > 0 && <dl className="review-data">{data.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
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

export function BranchPage() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const update = (changes) => setParams(updateParams(params, changes))
  const resource = useResource(`/branches/${encodeURIComponent(slug)}?${params}`)

  useEffect(() => {
    if (!resource.data?.branch || publicViews.has(slug)) return
    publicViews.add(slug)
    api(`/branches/${encodeURIComponent(slug)}/views`, { method: 'POST' }).catch(() => publicViews.delete(slug))
  }, [resource.data?.branch, slug])

  return <div className="shell page-pad">
    <LiveRefresh channel={`branches/${slug}`} onRefresh={resource.refresh} />
    <Link className="breadcrumb" to="/establecimientos">← Establecimientos</Link>
    {location.state?.notice && <p className="notice" role="status">{location.state.notice}</p>}
    <Status resource={resource}>
      {resource.data && (() => {
        const { branch, siblings, categories, items } = resource.data
        return <>
          <section className="branch-header">
            <div>
              <span className="eyebrow">FICHA DE SUCURSAL</span>
              <h1>{branch.name}</h1>
              <p className="branch-name">{branch.branch_name} · {branch.zone}</p>
              <p className="branch-location"><Icon name="pin" /> {branch.address}</p>
              <p className="mono muted">{branch.review_count} {branch.review_count === 1 ? 'aportación' : 'aportaciones'}{branch.latest_review && ` · Última: ${displayDate(branch.latest_review)}`}</p>
              {siblings.length > 1 && <label className="branch-select">Sucursal <select value={slug} onChange={(event) => navigate(goBranch(event.target.value))}>{siblings.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.zone}</option>)}</select></label>}
              <Link className="button button-dark" to={`/publicar?branch=${slug}`}><Icon name="plus" size={17} /> Escribir reseña</Link>
            </div>
            {branch.image_id && <img className="branch-photo" alt="Fotografía aportada por la comunidad" src={imageUrl(branch.image_id)} />}
          </section>
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
          </section>
        </>
      })()}
    </Status>
  </div>
}
