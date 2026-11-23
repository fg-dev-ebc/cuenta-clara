import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from './client.jsx'

const paths = {
  logo: 'M4 3h16v18l-4-2-4 2-4-2-4 2V3Zm4 5h8m-8 4h8m-8 4h4',
  search: 'M21 21l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  diagonal: 'M6 18 18 6M8 6h10v10',
  pin: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  comment: 'M21 4H3v14h4v3l5-3h9V4ZM7 9h10m-10 4h7',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1',
  plus: 'M12 4v16M4 12h16',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm5 5 14 14M19 5 5 19',
  chevron: 'm6 9 6 6 6-6',
  edit: 'm13.5 6.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z',
  admin: 'M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-4',
  logout: 'M10 4H5v16h5m-1-8h11m-4-4 4 4-4 4',
  fork: 'M6 3v6c0 2 2 3 3 3s3-1 3-3V3M9 3v18m10-18v18m0-18c-3 2-4 5-4 8h4',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3V7Zm12.5 6a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
}

export function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.list} /></svg>
}

export function Brand() {
  return <Link className="brand" to="/" aria-label="Cuenta Clara, inicio"><span className="brand-mark"><Icon name="logo" size={20} /></span><span>cuenta<span className="brand-divider">.</span>clara</span></Link>
}

export function Header() {
  const { user, client, account } = useAuth()
  const [open, setOpen] = useState(false)
  const [logout, setLogout] = useState({})
  const profile = useRef(null)
  const location = useLocation()
  useEffect(() => {
    setOpen(false)
    if (profile.current) profile.current.open = false
  }, [location.pathname])
  useEffect(() => {
    if (!user) return
    const dismiss = (event) => {
      const menu = profile.current
      if (menu?.open && !menu.contains(event.target)) menu.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [Boolean(user)])
  async function signOut() {
    setLogout({ busy: true })
    try {
      const { error } = await client.signOut()
      if (error) throw error
      window.location.assign('/')
    } catch {
      setLogout({ error: 'No pudimos cerrar sesión. Intenta de nuevo.' })
    }
  }
  return <header className="site-header">
    <a className="skip" href="#contenido">Saltar al contenido</a>
    <div className="shell header-inner">
      <Brand />
      <div className="header-end">
        <button className="icon-button mobile-menu" type="button" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="nav"
          onClick={() => { if (profile.current) profile.current.open = false; setOpen(!open) }}><Icon name={open ? 'close' : 'menu'} /></button>
        <nav id="nav" className={`nav ${open ? 'is-open' : ''}`} aria-label="Principal">
          <NavLink to="/establecimientos">Explorar</NavLink>
          {user ? <NavLink to="/mis-aportaciones">Mis aportaciones</NavLink> : <NavLink to="/login">Iniciar sesión</NavLink>}
          <Link className="button button-dark header-cta" to="/publicar"><Icon name="plus" size={16} /> Publicar</Link>
        </nav>
        {user && <details className="account-menu" ref={profile} onToggle={(event) => {
          if (event.currentTarget.open) setOpen(false)
        }} onKeyDown={(event) => {
          if (event.key === 'Escape' && event.currentTarget.open) {
            event.currentTarget.open = false
            event.currentTarget.querySelector('summary')?.focus()
          }
        }}>
          <summary className="account-trigger" aria-label="Mi perfil">
            <Avatar id={account?.avatar_id} alias={account?.alias || user.name} />
            <span className="account-label">Mi perfil</span><Icon name="chevron" size={15} />
          </summary>
          <nav className="account-dropdown" aria-label="Mi cuenta" onClick={(event) => {
            if (event.target.closest('a') && profile.current) profile.current.open = false
          }}>
            <NavLink to="/perfil"><Icon name="edit" size={16} /> Editar perfil</NavLink>
            {account?.admin && <NavLink to="/admin/dashboard"><Icon name="admin" size={16} /> Administración</NavLink>}
            <button className="account-logout" type="button" disabled={logout.busy} onClick={signOut}>
              <Icon name="logout" size={16} /> {logout.busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
            {logout.error && <p className="muted" role="alert">{logout.error}</p>}
          </nav>
        </details>}
      </div>
    </div>
  </header>
}

export function Footer() {
  return <footer className="site-footer">
    <div className="shell footer-content">
      <div><Brand /><p>Información clara antes de ir.</p></div>
      <div className="footer-links"><Link to="/establecimientos">Explorar</Link><Link to="/terminos">Términos</Link><Link to="/privacidad">Privacidad</Link></div>
      <span className="mono footer-note">DIRECTORIO COLABORATIVO<span className="terminal-dot" /></span>
    </div>
  </footer>
}

export function SectionHead({ number, title, description, icon, action }) {
  return <div className="section-head">
    <div>
      {number && <span className="eyebrow">{number}</span>}
      <h2>{icon && <Icon name={icon} size={24} />} {title}</h2>
      {description && <p>{description}</p>}
    </div>{action}
  </div>
}

export function Empty({ title = 'Sin reportes disponibles', description, children, icon = 'list' }) {
  return <div className="empty">
    <span className="empty-mark"><Icon name={icon} size={22} /></span>
    <div><p className="empty-title">{title}</p>{description && <p className="muted">{description}</p>}{children}</div>
  </div>
}

export function Status({ resource, children }) {
  if (resource.loading) return <p className="loading mono" role="status">Cargando…</p>
  if (resource.error && !resource.data) return <div className="notice" role="alert"><p>{resource.error.message}</p><button className="text-button underline" onClick={resource.refresh}>Reintentar</button></div>
  return children
}

export function Pagination({ page, hasNext, onPage }) {
  if (page < 2 && !hasNext) return null
  return <nav className="pagination" aria-label="Paginación">
    <button className="button button-outline" disabled={page < 2} onClick={() => onPage(page - 1)}>Anterior</button>
    <span className="mono">Página {page}</span>
    <button className="button button-outline" disabled={!hasNext} onClick={() => onPage(page + 1)}>Siguiente</button>
  </nav>
}

export const statuses = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', linked: 'Vinculada', published: 'Publicada',
  hidden: 'Oculta', removed: 'Retirada', active: 'Activa', inactive: 'Inactiva', resolved: 'Resuelto', dismissed: 'Desestimado', accepted: 'Aceptada',
}
export const Badge = ({ children }) => <span className="badge">{children}</span>
export const displayDate = (value) => value ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : '—'
export const currency = (amount, code) => amount == null ? '' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: code || 'MXN', currencyDisplay: 'code' }).format(amount)
export const goBranch = (slug) => `/establecimientos/${slug}`
export const imageUrl = (id) => `/api/images/${id}`

export function Avatar({ id, alias, source, large = false }) {
  const image = source || (id ? `/api/avatars/${id}` : null)
  return <span className={`avatar${large ? ' avatar-large' : ''}`} aria-hidden="true">
    {image ? <img src={image} alt="" /> : (alias?.trim().charAt(0) || '·').toUpperCase()}
  </span>
}

export function MessageForm({ label, onSubmit, onClose }) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  return <form className="inline-form" onSubmit={async (event) => {
    event.preventDefault()
    const message = new FormData(event.currentTarget).get('message')
    setBusy(true)
    try { await onSubmit(message); setFeedback({ ok: true, message: 'Solicitud enviada.' }) }
    catch (error) { setFeedback({ message: error.message }) }
    finally { setBusy(false) }
  }}>
    {feedback && <p className="notice" role={feedback.ok ? 'status' : 'alert'}>{feedback.message}</p>}
    {!feedback?.ok && <label>{label}<textarea name="message" rows={3} minLength={8} maxLength={600} required /></label>}
    <div className="form-actions">
      {!feedback?.ok && <button className="button button-dark" disabled={busy}>{busy ? 'Enviando…' : 'Enviar'}</button>}
      <button type="button" className="button button-outline" onClick={onClose}>Cerrar</button>
    </div>
  </form>
}
