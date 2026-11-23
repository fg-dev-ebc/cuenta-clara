import { useState } from 'react'
import { Link, NavLink, Outlet, useParams, useSearchParams } from 'react-router'
import { LiveRefresh, useAuth, useResource } from './client.jsx'
import { ReviewContents } from './directory.jsx'
import { BranchFields, branchFieldsFrom, BranchPicker, kindLabels, PlacesAttribution, PlaceSummary } from './publish.jsx'
import { Badge, displayDate, Empty, goBranch, Pagination, Status, statuses } from './ui.jsx'

const sections = [
  ['dashboard', 'Resumen'], ['establecimientos', 'Establecimientos'], ['solicitudes', 'Solicitudes'],
  ['reportes', 'Reportes'], ['correcciones', 'Correcciones'], ['categorias', 'Categorías'],
]

export function AdminLayout() {
  return <div className="shell admin-layout page-pad">
    <aside><span className="eyebrow">OPERACIONES / PRIVADO</span><h2>Administración</h2>
      <nav aria-label="Administración">{sections.map(([route, title]) => <NavLink to={`/admin/${route}`} key={route}>{title}</NavLink>)}</nav>
    </aside>
    <div className="admin-main"><Outlet /></div>
  </div>
}

function AdminTitle({ title, description }) {
  return <><h1 className="page-title">{title}</h1>{description && <p className="lede">{description}</p>}</>
}

function Table({ headings, children }) {
  return <div className="table-scroll" tabIndex="0" role="region" aria-label="Tabla de administración">
    <table><thead><tr>{headings.map((item) => <th key={item} scope="col">{item}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>
}

async function secureUploadLink(request, id) {
  const result = await request(`/admin/images/${id}`)
  return result.url
}

function AdminImages({ ids }) {
  const { request } = useAuth()
  const [links, setLinks] = useState([])
  const [error, setError] = useState('')
  if (!ids?.length) return null
  return <div className="admin-image-list">
    <button className="button button-outline" type="button" onClick={async () => {
      setError('')
      try { setLinks(await Promise.all(ids.map((id) => secureUploadLink(request, id)))) }
      catch (err) { setError(err.message) }
    }}>Cargar imágenes privadas ({ids.length})</button>
    {error && <p className="notice" role="alert">{error}</p>}
    <div className="review-images">{links.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img alt={`Imagen de revisión ${index + 1}`} src={url} /></a>)}</div>
  </div>
}

function MutationForm({ onSend, children, label = 'Guardar', className = 'form-panel', success = 'Cambios guardados.' }) {
  const [state, setState] = useState({})
  return <form className={className} onSubmit={async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setState({ busy: true })
    try { await onSend(form); setState({ ok: success }) } catch (error) { setState({ error: error.message }) }
  }}>
    {children}
    {state.error && <p className="notice" role="alert">{state.error}</p>}
    {state.ok && <p className="notice" role="status">{state.ok}</p>}
    <button className="button button-dark" disabled={state.busy}>{state.busy ? 'Guardando…' : label}</button>
  </form>
}

export function Dashboard() {
  const { request } = useAuth()
  const resource = useResource('/admin/dashboard', request)
  const labels = { establishments: 'Establecimientos', branches: 'Sucursales', reviews: 'Reseñas públicas', pending: 'Altas pendientes', rejected: 'Altas rechazadas', reports: 'Reportes pendientes', corrections: 'Correcciones pendientes' }
  return <>
    <AdminTitle title="Resumen" description="Actividad del directorio y solicitudes por revisar." />
    <LiveRefresh channel="admin" privileged onRefresh={resource.refresh} />
    <Status resource={resource}>{resource.data && <>
      <div className="metrics">{Object.entries(labels).map(([key, label]) => <div key={key}><span className="mono">{resource.data.metrics[key]}</span><p>{label}</p></div>)}</div>
      <h2>Actividad reciente</h2>
      {resource.data.logs.length ? <Table headings={['Acción', 'Fecha', 'Detalle']}>{resource.data.logs.map((item) => <tr key={item.id}>
        <td>{item.action}</td><td className="mono">{displayDate(item.created_at)}</td><td>{item.message || '—'}</td></tr>)}</Table>
        : <Empty title="No hay actividad registrada" />}
    </>}</Status>
  </>
}

export function AdminBranches() {
  const { request } = useAuth()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const q = params.get('q') || ''
  const page = params.get('page') || 1
  const resource = useResource(`/admin/branches?q=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`, request)
  function save(path, method, extra = {}) {
    return async (form) => { await request(path, { method, body: { ...branchFieldsFrom(form), ...extra, ...(method === 'PATCH' ? { status: form.get('status') } : {}) } }); resource.refresh() }
  }
  return <>
    <AdminTitle title="Establecimientos" description="Busca, registra y actualiza sucursales del directorio." />
    <div className="admin-toolbar">
      <form className="picker-search" onSubmit={(event) => { event.preventDefault(); setParams({ q: new FormData(event.currentTarget).get('q') }) }}>
        <label>Buscar sucursal<input name="q" type="search" defaultValue={q} maxLength={120} /></label>
        <button className="button button-outline">Buscar</button>
      </form>
      <button className="button button-dark" type="button" onClick={() => setAdding(!adding)}>{adding ? 'Cerrar alta' : 'Registrar sucursal'}</button>
    </div>
    {adding && <MutationForm onSend={save('/admin/branches', 'POST')} label="Registrar sucursal"><BranchFields /></MutationForm>}
    {editing && <MutationForm key={editing.id} onSend={save(`/admin/branches/${editing.id}`, 'PATCH')}>
      <BranchFields item={editing} heading="Editar sucursal" />
      <p className="help">Cambiar el nombre del establecimiento afecta a todas sus sucursales.</p>
      <label>Visibilidad<select name="status" defaultValue={editing.status}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>
      <button className="text-button" type="button" onClick={() => setEditing(null)}>Cerrar edición</button>
    </MutationForm>}
    <Status resource={resource}>
      {resource.data?.items.length ? <Table headings={['Establecimiento', 'Sucursal', 'Zona', 'Estado', 'Acción']}>
        {resource.data.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.branch_name}</td><td>{item.zone}</td>
          <td><Badge>{statuses[item.status]}</Badge></td><td><button className="text-button underline" onClick={() => setEditing(item)}>Editar</button></td></tr>)}</Table>
        : <Empty title="No hay sucursales en esta vista" />}
      {resource.data && <Pagination {...resource.data} onPage={(next) => setParams({ q, page: next })} />}
    </Status>
  </>
}

function InboxFilter({ params, setParams, options }) {
  return <label className="inbox-filter">Estado<select value={params.get('status') || options[0]}
    onChange={(event) => setParams({ status: event.target.value })}>
    {[...options, 'all'].map((option) => <option key={option} value={option}>{statuses[option] || 'Todos'}</option>)}
  </select></label>
}

export function AdminRequests() {
  const { request } = useAuth()
  const [params, setParams] = useSearchParams()
  const resource = useResource(`/admin/requests?${params}`, request)
  return <>
    <AdminTitle title="Solicitudes de alta" description="La aprobación corresponde al establecimiento o sucursal, no a la reseña individual." />
    <LiveRefresh channel="admin" privileged onRefresh={resource.refresh} />
    <InboxFilter params={params} setParams={setParams} options={['pending', 'approved', 'rejected', 'linked']} />
    <Status resource={resource}>
      {resource.data?.items.length ? <Table headings={['Establecimiento', 'Solicitante', 'Fecha', 'Estado']}>
        {resource.data.items.map((item) => <tr key={item.id}>
          <td><Link className="underline" to={`/admin/solicitudes/${item.id}`}>{item.proposed_name || 'Sucursal de Google Places'}</Link>
            {item.branch_name && <small>{item.branch_name} · {item.zone}</small>}</td>
          <td>{item.alias}</td><td className="mono">{displayDate(item.created_at)}</td><td><Badge>{statuses[item.status]}</Badge></td>
        </tr>)}</Table> : <Empty title="No hay solicitudes en esta vista" />}
      {resource.data && <Pagination {...resource.data} onPage={(page) => setParams({ status: params.get('status') || 'pending', page })} />}
    </Status>
  </>
}

export function AdminRequest() {
  const { id } = useParams()
  const { request } = useAuth()
  const resource = useResource(`/admin/requests/${id}`, request)
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('')
  const [showReference, setShowReference] = useState(false)
  const reference = useResource(showReference ? `/admin/requests/${id}/places-reference` : null, request)
  const resolve = async (body) => { await request(`/admin/requests/${id}/resolve`, { body }); resource.refresh() }
  return <>
    <Link to="/admin/solicitudes" className="breadcrumb">← Solicitudes</Link>
    <AdminTitle title="Revisar alta" />
    <Status resource={resource}>
      {resource.data && (() => {
        const item = resource.data
        return <>
          <div className="review-card">
            <div className="review-head"><Badge>{statuses[item.status]}</Badge><span className="mono">{displayDate(item.created_at)}</span></div>
            <h2>{item.proposed_name || 'Sucursal de Google Places'}</h2>
            {item.branch_name && <p>{item.branch_name} · {item.zone}</p>}{item.address && <p>{item.address}</p>}
            <p className="mono muted">Solicitante: {item.alias} · ID Google Places: {item.place_id || '—'}</p>
            {item.place_id && <button type="button" className="button button-outline" aria-expanded={showReference}
              onClick={() => setShowReference((open) => !open)}>{showReference ? 'Ocultar referencia' : 'Consultar referencia de Google Places'}</button>}
            {showReference && <Status resource={reference}>{reference.data && <div className="google-panel">
              <PlaceSummary place={reference.data} /><PlacesAttribution />
            </div>}</Status>}
            {item.reason && <p className="notice">{item.reason}</p>}
          </div>
          <div className="review-card">
            <div className="review-head"><Badge>{item.category}</Badge><span>Primera reseña</span></div>
            <ReviewContents review={item} /><AdminImages ids={item.image_ids} />
          </div>
          {item.status === 'pending' && <>
            <h2>Posibles duplicados</h2>
            {item.duplicates.length ? <div className="picker-results">{item.duplicates.map((branch) => <button key={branch.id}
              disabled={branch.status !== 'active'} className="picker-result" onClick={() => { setSelected(branch); setMode('link') }}>
              <span>{branch.name} · {branch.branch_name}<small>{branch.zone} · {branch.address}</small></span>
            </button>)}</div> : <p className="muted">No se detectaron coincidencias.</p>}
            <div className="form-actions">
              {[['approve', 'Aprobar nueva ficha'], ['link', 'Vincular existente'], ['reject', 'Rechazar alta']].map(([value, label]) => <button key={value}
                className="button button-outline" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}
            </div>
            {mode === 'approve' && <MutationForm label="Aprobar y publicar" onSend={(form) => resolve({ action: 'approve', branch: {
              ...branchFieldsFrom(form), establishmentId: item.establishment_id ?? undefined,
            } })}>
              <BranchFields item={item} heading="Datos públicos de la sucursal" />
              {item.place_id && <p className="help">Completa los datos de la ficha con información de una fuente autorizada. La referencia de Google no se incorpora automáticamente.</p>}
            </MutationForm>}
            {mode === 'reject' && <MutationForm label="Confirmar rechazo" onSend={(form) => resolve({ action: 'reject', reason: form.get('reason') })}>
              <label>Motivo visible al solicitante<textarea name="reason" required minLength={8} maxLength={600} /></label></MutationForm>}
            {mode === 'link' && <>
              <BranchPicker initial={item.proposed_name ?? ''} onSelect={setSelected} label="Buscar una sucursal aprobada" />
              {selected && <MutationForm label="Vincular y publicar" onSend={() => resolve({ action: 'link', branchId: selected.id })}>
                <p>{selected.name} · {selected.branch_name} · {selected.zone}</p></MutationForm>}
            </>}
          </>}
        </>
      })()}
    </Status>
  </>
}

function CategoryEditor({ item, reload, onClose }) {
  const { request } = useAuth()
  return <MutationForm onSend={async (form) => {
    await request(item?.id ? `/admin/categories/${item.id}` : '/admin/categories', { method: item?.id ? 'PATCH' : 'POST', body: {
      name: form.get('name'), position: Number(form.get('position')), formKind: form.get('kind'), active: form.has('active'),
    } })
    reload()
  }}>
    <div className="field-grid">
      <label>Nombre<input name="name" defaultValue={item?.name} minLength={2} maxLength={50} required /></label>
      <label>Tipo de formulario<select name="kind" defaultValue={item?.form_kind ?? 'general'}>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Orden<input name="position" type="number" min={0} max={9999} defaultValue={item?.position ?? 100} required /></label>
      <label className="check-label"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Disponible para nuevas reseñas</label>
    </div>
    <button type="button" className="text-button" onClick={onClose}>Cerrar edición</button>
  </MutationForm>
}

export function AdminCategories() {
  const { request } = useAuth()
  const resource = useResource('/admin/categories', request)
  const [item, setItem] = useState(null)
  return <>
    <AdminTitle title="Categorías" description="Configura las categorías disponibles sin borrar aportaciones anteriores." />
    <button className="button button-dark" onClick={() => setItem({})}>Añadir categoría</button>
    {item && <CategoryEditor key={item.id ?? 'new'} item={item} reload={resource.refresh} onClose={() => setItem(null)} />}
    <Status resource={resource}>{resource.data && <Table headings={['Categoría', 'Formulario', 'Orden', 'Estado', 'Acción']}>
      {resource.data.map((row) => <tr key={row.id}><td>{row.name}</td><td>{kindLabels[row.form_kind]}</td><td className="mono">{row.position}</td>
        <td><Badge>{row.active ? 'Activa' : 'Inactiva'}</Badge></td><td><button className="text-button underline" onClick={() => setItem(row)}>Editar</button></td></tr>)}
    </Table>}</Status>
  </>
}

export function AdminModeration({ corrections = false }) {
  const { request } = useAuth()
  const [params, setParams] = useSearchParams()
  const [active, setActive] = useState(null)
  const entity = corrections ? 'corrections' : 'reports'
  const options = corrections ? ['pending', 'accepted', 'rejected'] : ['pending', 'resolved', 'dismissed']
  const resource = useResource(`/admin/${entity}?${params}`, request)
  return <>
    <AdminTitle title={corrections ? 'Solicitudes de corrección' : 'Reseñas reportadas'}
      description={corrections ? 'Revisa las solicitudes de los autores. Los usuarios no editan sus reseñas directamente.' : 'Modera las reseñas después de que la comunidad reporte un problema.'} />
    <LiveRefresh channel="admin" privileged onRefresh={resource.refresh} />
    <InboxFilter params={params} setParams={setParams} options={options} />
    <Status resource={resource}>
      {resource.data?.items.length ? resource.data.items.map((item) => <article key={item.id} className="review-card">
        <div className="review-head"><Badge>{statuses[item.status]}</Badge><span className="mono">{displayDate(item.created_at)} · {item.alias}</span></div>
        <h2>{item.title}</h2>
        <p>{item.message}</p>
        <p className="muted">Visibilidad de la reseña: {statuses[item.review_status]}</p>
        {item.resolution && <p className="notice">{item.resolution}</p>}
        <button className="text-button underline" aria-expanded={active === item.id} onClick={() => setActive(active === item.id ? null : item.id)}>Ver reseña y resolución</button>
        {active === item.id && <>
          <p className="review-body">{item.description}</p>
          {item.slug && item.review_status === 'published' && <Link className="inline-link" to={goBranch(item.slug)}>Ir a la ficha</Link>}
          <AdminImages ids={item.image_ids} />
          {item.status === 'pending' && <MutationForm onSend={async (form) => {
            await request(`/admin/${entity}/${item.id}/resolve`, { body: { status: form.get('status'), resolution: form.get('resolution'), visibility: form.get('visibility'),
              title: form.get('title') || undefined, description: form.get('description') || undefined } })
            resource.refresh()
          }} label="Resolver">
            <div className="field-grid">
              <label>Decisión<select name="status">{options.slice(1).map((option) => <option key={option} value={option}>{statuses[option]}</option>)}</select></label>
              <label>Visibilidad<select name="visibility"><option value="unchanged">Sin cambios</option><option value="hidden">Ocultar</option><option value="removed">Retirar</option></select></label>
              {corrections && <>
                <label className="span-full">Título corregido (solo al aceptar)<input name="title" minLength={4} maxLength={100} /></label>
                <label className="span-full">Descripción corregida (opcional)<textarea name="description" minLength={15} maxLength={3000} /></label>
              </>}
              <label className="span-full">Motivo<textarea name="resolution" required minLength={8} maxLength={600} /></label>
            </div>
          </MutationForm>}
        </>}
      </article>) : <Empty title="No hay elementos en esta vista" />}
      {resource.data && <Pagination {...resource.data} onPage={(page) => setParams({ status: params.get('status') || 'pending', page })} />}
    </Status>
  </>
}
