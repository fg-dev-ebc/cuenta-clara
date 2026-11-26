import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth, useConfig, useResource } from './client.jsx'
import { Badge, Empty, goBranch, Icon, PageHeading, Pagination, Status } from './ui.jsx'
import { mediaTypes, uploadImage, validImage } from './uploads.js'
import mapsLogo from './GoogleMaps_Logo_DarkGray.svg'

const selectOptions = {
  timing: ['Antes', 'Durante', 'Al recibir la cuenta', 'No se informó'],
  availability: ['Disponible', 'No disponible', 'No confirmado'],
  parkingType: ['Del restaurante', 'De la plaza', 'En la vía pública', 'Otro'],
}
const kindLabels = {
  general: 'General', price: 'Precio / promoción', buffet: 'Buffet', tip: 'Propina', parking: 'Estacionamiento', charge: 'Cargo',
}
export { kindLabels }

function ImagePreview({ file }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return src && <img src={src} alt={`Vista previa de ${file.name}`} />
}

function ImageUploader({ files, setFiles }) {
  const [error, setError] = useState('')
  return <div className="image-uploader">
    <label><Icon name="camera" /> Adjuntar fotos <span className="help">Opcional · hasta 3 archivos JPG, PNG o WebP. 5 MB por archivo.</span>
      <input type="file" accept={mediaTypes.join(',')} multiple disabled={files.length >= 3} onChange={(event) => {
        const selected = [...event.target.files]
        event.target.value = ''
        if (selected.length + files.length > 3 || selected.some((file) => !validImage(file))) {
          setError('Selecciona hasta tres imágenes JPG, PNG o WebP de máximo 5 MB.')
          return
        }
        setError('')
        setFiles([...files, ...selected])
      }} /></label>
    {error && <p className="notice" role="alert">{error}</p>}
    {files.length > 0 && <div className="upload-previews">{files.map((file, index) => <div key={`${file.name}-${index}`}><ImagePreview file={file} />
      <button type="button" className="text-button" aria-label={`Quitar ${file.name}`} onClick={() => setFiles(files.filter((_, at) => at !== index))}>Quitar</button>
    </div>)}</div>}
  </div>
}

function SelectField({ label, name }) {
  return <label>{label}<select name={name}><option value="">Sin especificar</option>{selectOptions[name].map((value) => <option key={value}>{value}</option>)}</select></label>
}

function DetailsFields({ kind }) {
  const charge = kind === 'charge'
  const price = kind === 'price' || kind === 'buffet'
  return <div className="field-grid review-fields">
    {price && <label>Precio anunciado<input name="advertisedPrice" type="number" min="0" step="0.01" /></label>}
    {charge && <label>Concepto del cargo<input name="concept" maxLength={120} /></label>}
    {(charge || kind === 'tip') && <SelectField label="Cuándo se informó" name="timing" />}
    {kind === 'tip' && <label>Porcentaje de propina<input name="percentage" type="number" min="0" max="100" step="0.01" /></label>}
    {kind === 'parking' && <><SelectField label="Disponibilidad" name="availability" /><SelectField label="Tipo de estacionamiento" name="parkingType" /></>}
    {(price || charge || kind === 'parking') && <label className="span-full">Condiciones adicionales<textarea name="conditions" rows={2} maxLength={450} /></label>}
  </div>
}

export function ReviewForm({ branch, submittingRequest = false, onSubmit, branchFields, optionalNote }) {
  const categories = useResource('/categories')
  const { request } = useAuth()
  const [categoryId, setCategoryId] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kind] = categories.data?.filter((item) => item.id === categoryId).map((item) => item.form_kind) ?? []
  return <form className="form-panel review-form" onSubmit={async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name) => String(form.get(name) || '').trim()
    const details = {}
    for (const name of ['advertisedPrice', 'conditions', 'concept', 'timing', 'percentage', 'availability', 'parkingType']) {
      if (value(name)) details[name] = ['advertisedPrice', 'percentage'].includes(name) ? Number(value(name)) : value(name)
    }
    setBusy(true); setError('')
    try {
      const uploads = await Promise.all(files.map((file) => uploadImage(request, file)))
      await onSubmit({
        categoryId, title: value('title'), description: value('description'), visitedOn: value('visitedOn'),
        amount: value('amount') ? Number(value('amount')) : undefined, currency: value('currency'), details, uploads,
      }, form)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }}>
    {branchFields}
    {branch && <div className="selected-branch"><Icon name="pin" /><div><strong>{branch.name}</strong><p>{branch.branch_name} · {branch.zone}</p></div></div>}
    <Status resource={categories}>
      <label>Categoría<select name="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Elige una categoría</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </Status>
    <label>Título<input name="title" minLength={4} maxLength={100} placeholder="Ej. El precio del buffet no incluía bebidas" required /></label>
    <label>¿Qué encontraste?<textarea name="description" rows={5} minLength={15} maxLength={3000} placeholder="Cuenta qué pasó y en qué condiciones. No compartas datos personales." required /></label>
    <div className="field-grid">
      <label>Fecha de visita<input name="visitedOn" type="date" max={new Date().toISOString().slice(0, 10)} required /></label>
      <label>Monto reportado (opcional)<input name="amount" type="number" min="0" max="9999999999.99" step="0.01" placeholder="0.00" /></label>
      <label>Moneda<select name="currency" defaultValue="MXN"><option>MXN</option><option>USD</option><option>EUR</option><option>CAD</option><option>ARS</option><option>COP</option><option>CLP</option><option>PEN</option></select></label>
    </div>
    {kind && <DetailsFields key={kind} kind={kind} />}
    <ImageUploader files={files} setFiles={setFiles} />
    <p className="help">{optionalNote || 'Al publicar, no podrás editar ni eliminar la reseña directamente. Podrás solicitar una corrección.'}</p>
    {error && <p className="notice" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy || !categories.data?.length}>{busy ? 'Enviando…' : submittingRequest ? 'Enviar solicitud y reseña' : 'Publicar reseña'} <Icon name="arrow" size={16} /></button>
  </form>
}

export function BranchPicker({ path = '/directory', onSelect, initial = '', label = 'Buscar en Cuenta Clara' }) {
  const [search, setSearch] = useState(initial)
  const [page, setPage] = useState(1)
  const { request } = useAuth()
  const list = useResource(`${path}?q=${encodeURIComponent(search)}&page=${page}`, path.startsWith('/admin') ? request : undefined)
  return <div className="picker">
    <form className="picker-search" onSubmit={(event) => {
      event.preventDefault()
      setSearch(new FormData(event.currentTarget).get('q').trim()); setPage(1)
    }}>
      <label>{label}<input name="q" type="search" maxLength={120} placeholder="Nombre, sucursal o zona" defaultValue={initial} /></label>
      <button className="button button-outline">Buscar</button>
    </form>
    <Status resource={list}>
      {list.data?.items.length ? <div className="picker-results">{list.data.items.map((item) => <button type="button" className="picker-result" key={item.id} onClick={() => onSelect(item)}>
        <span>{item.name}<small>{item.branch_name} · {item.zone}</small></span><Icon name="arrow" size={16} />
      </button>)}</div> : <Empty title="No encontramos sucursales" />}
      {list.data && <Pagination {...list.data} onPage={setPage} />}
    </Status>
  </div>
}

export function PublishPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { request } = useAuth()
  const slug = params.get('branch')
  const branch = useResource(slug ? `/branches/${encodeURIComponent(slug)}` : null)
  return <div className="shell reading page-pad">
    <PageHeading label="APORTAR / EXPERIENCIA" title="Escribir reseña" />
    <p className="lede">Comparte información específica sobre una visita, sin calificar al restaurante.</p>
    {!slug ? <>
      <BranchPicker onSelect={(item) => setParams({ branch: item.slug })} />
      <p className="directory-note">¿No encuentras el establecimiento? <Link to="/solicitar-establecimiento" className="underline">Propón un alta</Link></p>
    </> : <>
      <button className="text-button underline directory-note" onClick={() => setParams({})}>Elegir otra sucursal</button>
      <Status resource={branch}>{branch.data?.branch && <ReviewForm key={slug} branch={branch.data.branch} onSubmit={async (review) => {
        const published = await request('/reviews', { body: { ...review, branchId: branch.data.branch.id } })
        navigate(goBranch(published.slug), { state: { notice: 'Tu reseña ya está publicada.' } })
      }} />}</Status>
    </>}
  </div>
}

export function BranchFields({ item = {}, heading }) {
  return <>
    {heading && <h2 className="form-heading">{heading}</h2>}
    <div className="field-grid">
      <label>Nombre del establecimiento<input name="name" defaultValue={item.proposed_name ?? item.name} minLength={2} maxLength={120} required /></label>
      <label>Sucursal<input name="branchName" defaultValue={item.branch_name} maxLength={100} required /></label>
      <label>Zona<input name="zone" defaultValue={item.zone} maxLength={100} required /></label>
      <label>Dirección o referencia propia<input name="address" defaultValue={item.address} minLength={3} maxLength={250} required /></label>
    </div>
  </>
}

export const branchFieldsFrom = (form) => Object.fromEntries(['name', 'branchName', 'zone', 'address'].map((key) => [key, form.get(key)]))

export function PlacesAttribution() {
  return <div className="google-attribution"><img src={mapsLogo} alt="Google Maps" /></div>
}

export function PlaceSummary({ place }) {
  return <div><strong>{place.name}</strong><p className="muted">{place.address}</p>
    {place.attributions?.map(({ provider, providerUri }, index) => providerUri?.startsWith('https://')
      ? <a className="text-button underline" key={index} href={providerUri} rel="noreferrer" target="_blank">{provider}</a>
      : <small key={index}>{provider}</small>)}
  </div>
}

export function RequestPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { request } = useAuth()
  const { placesAvailable } = useConfig()
  const [selected, setSelected] = useState(null)
  const [manual, setManual] = useState(false)
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className="shell reading page-pad request-sheets">
    <PageHeading label="APORTAR / ALTA DE SUCURSAL" title="Proponer un establecimiento" />
    <p className="lede">Escribe tu primera reseña ahora. La verás publicada al aprobarse la ficha de esta sucursal.</p>
    <section className="google-panel">
      <h2>Buscar en Google Places</h2>
      <p className="muted">Opcional. Sirve para identificar el lugar, no para copiar datos al directorio.</p>
      {!placesAvailable ? <p className="help">La búsqueda de Google Places no está disponible. Puedes continuar con el alta manual.</p>
        : <form className="picker-search" onSubmit={async (event) => {
          event.preventDefault()
          const q = new FormData(event.currentTarget).get('q')
          setBusy(true); setError(''); setResults(null)
          try { setResults(await request('/places/search', { body: { q } })) }
          catch (err) { setError(err.message) }
          finally { setBusy(false) }
        }}>
          <label>Nombre y zona del restaurante<input name="q" type="search" minLength={3} maxLength={120} defaultValue={params.get('q') || ''} required /></label>
          <button className="button button-outline" disabled={busy}>{busy ? 'Buscando…' : 'Buscar en Google Places'}</button>
        </form>}
      {error && <p className="notice" role="alert">{error}</p>}
      {results && <div className="google-results">
        <PlacesAttribution />
        {!results.length && <p className="muted">No hubo coincidencias.</p>}
        {results.map((item) => <div className="google-result" key={item.id}>
          <PlaceSummary place={item} />
          {item.existingSlug ? <Link className="button button-outline" to={`/publicar?branch=${item.existingSlug}`}>Usar ficha existente</Link>
            : <button type="button" className="button button-outline" aria-pressed={selected?.id === item.id} onClick={() => {
              setSelected(item); setManual(false)
            }}>{selected?.id === item.id ? 'Seleccionada' : 'Seleccionar'}</button>}
        </div>)}
      </div>}
      {selected && <p className="directory-note"><Badge>Sucursal seleccionada</Badge> <button className="text-button underline" onClick={() => setSelected(null)}>Quitar selección</button></p>}
      {placesAvailable && !selected && <button type="button" className="text-button underline manual-toggle" aria-expanded={manual}
        onClick={() => setManual((value) => !value)}>{manual ? 'Cerrar alta manual' : 'Usar alta manual'}</button>}
    </section>
    {(selected || manual || !placesAvailable) && <ReviewForm submittingRequest
      optionalNote={selected ? 'Solo guardamos el identificador de Google. El equipo completará los datos de la sucursal durante la revisión. Tu reseña aún no será pública.'
        : 'Los datos del directorio deben proceder de tu visita o de una fuente autorizada. La reseña no será pública mientras se revisa el alta.'}
      branchFields={selected ? <div className="selected-place">
        <span className="eyebrow">SUCURSAL SELECCIONADA</span>
        <PlaceSummary place={selected} /><PlacesAttribution />
      </div> : <BranchFields heading="Datos de la sucursal" />} onSubmit={async (review, form) => {
        const branch = selected ? { placeId: selected.id } : branchFieldsFrom(form)
        const result = await request('/requests', { body: { review, branch } })
        if (result.existingSlug) {
          const existing = await request(`/branches/${result.existingSlug}`)
          const published = await request('/reviews', { body: { ...review, branchId: existing.branch.id } })
          navigate(goBranch(published.slug), { state: { notice: 'Encontramos la sucursal existente y publicamos tu reseña allí.' } })
        } else navigate('/mis-aportaciones')
      }} />}
  </div>
}
