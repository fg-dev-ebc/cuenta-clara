import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { useAuth, useResource } from './client.jsx'
import { Avatar, Badge, displayDate, Empty, goBranch, MessageForm, Pagination, Status, statuses } from './ui.jsx'
import { mediaTypes, uploadImage, validImage } from './uploads.js'
import googleMark from './google-signin-mark.png'

function safePage(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/'
  const url = new URL(value, window.location.origin)
  return url.origin === window.location.origin && !url.pathname.startsWith('//') ? `${url.pathname}${url.search}${url.hash}` : '/'
}

export function PrivatePage({ children, admin = false }) {
  const location = useLocation()
  const { user, loading, client, account, accountLoading } = useAuth()
  if (loading || (admin && user && accountLoading)) return <p className="shell page-pad mono" role="status">Comprobando acceso…</p>
  if (!client) return <div className="shell page-pad"><Empty title="El acceso a cuentas no está disponible" description="Inténtalo de nuevo en unos minutos." /></div>
  if (!user) return <Navigate replace to="/login" state={{ from: `${location.pathname}${location.search}` }} />
  if (!user.emailVerified || (admin && !account?.admin)) return <div className="shell page-pad"><Empty title="No tienes acceso a esta página"
    description={admin ? 'Esta sección es solo para el equipo de administración.' : 'Verifica tu correo para continuar.'} /></div>
  return children
}

function authError(error) {
  if (['INVALID_EMAIL_OR_PASSWORD', 'INVALID_PASSWORD'].includes(error.code)) return 'El correo o la contraseña no son correctos.'
  if (['INVALID_OTP', 'OTP_EXPIRED'].includes(error.code)) return 'El código es incorrecto o caducó. Puedes pedir otro.'
  if (error.status === 429) return 'Demasiados intentos. Espera un momento antes de continuar.'
  if (error.code === 'USER_ALREADY_EXISTS') return 'Ya existe una cuenta con ese correo.'
  return 'No pudimos completar la operación. Revisa los datos e inténtalo de nuevo.'
}

export function AuthPage({ register = false }) {
  const { client, user, loading } = useAuth()
  const { state } = useLocation()
  const [params] = useSearchParams()
  const from = safePage(state?.from ?? params.get('next'))
  const [step, setStep] = useState(register ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  if (user?.emailVerified) return <Navigate replace to={from} />

  async function run(handler) {
    setError(''); setNote(''); setBusy(true)
    try { await handler() } catch (err) { setError(authError(err)) } finally { setBusy(false) }
  }

  function googleSignIn() {
    run(async () => {
      const callback = new URL('/login', window.location.origin)
      callback.searchParams.set('next', from)
      const errorCallback = new URL(callback)
      errorCallback.searchParams.set('google', 'error')
      const { error } = await client.signIn.social({
        provider: 'google',
        callbackURL: callback.href,
        newUserCallbackURL: new URL('/perfil', window.location.origin).href,
        errorCallbackURL: errorCallback.href,
      })
      if (error) throw error
    })
  }

  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    run(async () => {
      if (step === 'verify') {
        const { error } = await client.emailOtp.verifyEmail({ email, otp: form.get('otp').trim() })
        if (error) throw error
        const { data } = await client.getSession()
        if (data?.user?.emailVerified) window.location.assign(from)
        else { setStep('login'); setNote('Correo verificado. Ya puedes iniciar sesión.') }
        return
      }
      const address = form.get('email').trim()
      const password = form.get('password')
      setEmail(address)
      if (step === 'register') {
        const { error } = await client.signUp.email({ email: address, password, name: form.get('name').trim() })
        if (error) throw error
        setStep('verify')
      } else {
        const { error } = await client.signIn.email({ email: address, password })
        if (error?.code === 'EMAIL_NOT_VERIFIED') {
          setStep('verify')
          setNote('Si no tienes un código vigente, solicita uno nuevo.')
        } else if (error) throw error
        else {
          const { data } = await client.getSession()
          if (data?.user) window.location.assign(from)
          else setError('No se pudo restaurar la sesión. Comprueba que el navegador permite las cookies de Cuenta Clara.')
        }
      }
    })
  }

  return <div className="shell narrow page-pad">
    <span className="eyebrow">CUENTA CLARA / ACCESO</span>
    <h1 className="page-title">{step === 'verify' ? 'Verifica tu correo' : step === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'}</h1>
    <p className="lede">{step === 'verify' ? `Ingresa el código enviado a ${email}.` : 'Puedes consultar el directorio sin cuenta. Inicia sesión para compartir una experiencia.'}</p>
    {loading ? <p className="loading mono">Cargando…</p> : !client ? <p className="notice" role="alert">El acceso a cuentas no está disponible.</p> :
      <form className="form-panel" key={step} onSubmit={submit}>
        {(error || params.get('google') === 'error') && <p className="notice" role="alert">{error || 'No se completó el acceso con Google. Intenta de nuevo o usa tu correo.'}</p>}
        {note && <p className="notice" role="status">{note}</p>}
        {step === 'verify'
          ? <label>Código de verificación<input name="otp" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{4,8}" maxLength={8} /></label>
          : <>
            {step === 'register' && <label>Alias público<input name="name" minLength={2} maxLength={50} pattern="[^@]+" required /><span className="help">Este nombre aparecerá junto a tus aportaciones. No uses tu correo.</span></label>}
            <label>Correo electrónico<input name="email" type="email" autoComplete="email" defaultValue={email} required maxLength={254} /></label>
            <label>Contraseña<input name="password" type="password" autoComplete={step === 'register' ? 'new-password' : 'current-password'}
              required minLength={step === 'register' ? 8 : undefined} maxLength={128} /></label>
          </>}
        <button disabled={busy} className="button button-dark">{busy ? 'Un momento…' : step === 'verify' ? 'Verificar' : step === 'register' ? 'Registrarme' : 'Entrar'}</button>
        {step !== 'verify' && <div className="alternate-signin">
          <button type="button" className="button google-signin" disabled={busy} onClick={googleSignIn}>
            <img src={googleMark} alt="" width="18" height="18" /> Continuar con Google
          </button>
        </div>}
        {step === 'verify' && <button type="button" disabled={busy} className="text-button underline" onClick={() => run(async () => {
          const { error } = await client.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
          if (error) throw error
          setNote('Solicitamos un nuevo código. Revisa tu correo.')
        })}>Solicitar un nuevo código</button>}
      </form>}
    <p className="directory-note">{register ? '¿Ya tienes cuenta? ' : '¿Todavía no tienes cuenta? '}
      <Link className="underline" state={{ from }} to={register ? '/login' : '/registro'}>{register ? 'Inicia sesión' : 'Regístrate'}</Link></p>
  </div>
}

function ProfileForm({ account, email, request, refresh }) {
  const [alias, setAlias] = useState(account.alias)
  const [avatarId, setAvatarId] = useState(account.avatar_id)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [remove, setRemove] = useState(false)
  const [status, setStatus] = useState({})
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <form className="form-panel" onSubmit={async (event) => {
    event.preventDefault()
    setStatus({ busy: true })
    try {
      const avatarUploadId = file ? await uploadImage(request, file) : remove ? null : undefined
      const saved = await request('/account/profile', { method: 'PATCH', body: { alias, avatarUploadId } })
      setAlias(saved.alias); setAvatarId(saved.avatar_id); setFile(null); setPreview(null); setRemove(false)
      setStatus({ ok: 'Perfil actualizado.' })
      refresh()
    } catch (error) { setStatus({ error: error.message }) }
  }}>
    <div className="profile-photo">
      <Avatar id={remove ? null : avatarId} source={file ? preview : null} alias={alias} large />
      <div>
        <label>Foto de perfil<input type="file" accept={mediaTypes.join(',')} disabled={status.busy} onChange={(event) => {
          const picked = event.target.files?.[0]
          event.target.value = ''
          if (!picked) return
          if (!validImage(picked)) { setStatus({ error: 'Elige una foto JPG, PNG o WebP de máximo 5 MB.' }); return }
          setFile(picked); setRemove(false); setStatus({})
        }} /></label>
        {(file || (avatarId && !remove)) && <button type="button" className="text-button underline" disabled={status.busy} onClick={() => {
          setFile(null); setPreview(null); setRemove(true)
        }}>Quitar foto</button>}
      </div>
    </div>
    <label>Alias público<input value={alias} onChange={(event) => setAlias(event.target.value)} minLength={2} maxLength={50} pattern="[^@]+" disabled={status.busy} required /></label>
    <label>Correo de acceso<input value={email || ''} type="email" readOnly /><span className="help">Este correo no se muestra en tu perfil público.</span></label>
    {status.error && <p className="notice" role="alert">{status.error}</p>}
    {status.ok && <p className="notice" role="status">{status.ok}</p>}
    <button className="button button-dark" disabled={status.busy}>{status.busy ? 'Guardando…' : 'Guardar perfil'}</button>
  </form>
}

export function ProfilePage() {
  const { user, account, accountLoading, accountError, refreshAccount, request } = useAuth()
  return <div className="shell reading page-pad">
    <span className="eyebrow">MI CUENTA</span>
    <h1 className="page-title">Mi perfil</h1>
    <p className="lede">Tu alias y tu foto acompañan tus reseñas. Puedes cambiarlos cuando quieras.</p>
    <Status resource={{ loading: accountLoading, error: accountError, data: account, refresh: refreshAccount }}>
      {account && <ProfileForm key={account.id} account={account} email={user?.email} request={request} refresh={refreshAccount} />}
    </Status>
  </div>
}

function Contribution({ item, request }) {
  const [correcting, setCorrecting] = useState(false)
  return <article className="review-card">
    <div className="review-head"><Badge>{statuses[item.request_status] || statuses[item.status]}</Badge><span className="mono">{displayDate(item.created_at)}</span></div>
    <h3>{item.title}</h3>
    {item.slug && item.status === 'published' ? <Link className="underline" to={goBranch(item.slug)}>{item.name} · {item.branch_name}</Link>
      : <p className="muted">{item.name || item.proposed_name || (item.proposed_with_google ? 'Sucursal seleccionada en Google Places' : 'Sucursal propuesta')}
        {(item.branch_name || item.proposed_branch) && ` · ${item.branch_name || item.proposed_branch}`}</p>}
    {item.request_status === 'rejected' && <p className="notice">Motivo del rechazo: {item.reason}</p>}
    {item.correction_status && <p className="muted">Solicitud de corrección: {statuses[item.correction_status]}.</p>}
    {item.status === 'published' && <button className="text-button report-link" onClick={() => setCorrecting(!correcting)} aria-expanded={correcting}>Solicitar una corrección</button>}
    {correcting && <MessageForm label="¿Qué información necesita corregirse?" onClose={() => setCorrecting(false)}
      onSubmit={(message) => request(`/reviews/${item.id}/correction`, { body: { message } })} />}
  </article>
}

export function MyContributions() {
  const { request } = useAuth()
  const [params, setParams] = useSearchParams()
  const list = useResource(`/account/contributions?page=${encodeURIComponent(params.get('page') ?? '1')}`, request)
  return <div className="shell reading page-pad">
    <span className="eyebrow">MI CUENTA</span>
    <h1 className="page-title">Mis aportaciones</h1>
    <p className="lede">Consulta tus reseñas, solicitudes de alta y el estado de tus correcciones.</p>
    <Status resource={list}>
      {list.data?.items.length ? <div className="reviews">{list.data.items.map((item) => <Contribution key={item.id} item={item} request={request} />)}</div>
        : <Empty title="Todavía no has aportado reseñas"><Link className="inline-link" to="/publicar">Escribe una reseña →</Link></Empty>}
      {list.data && <Pagination {...list.data} onPage={(page) => setParams({ page })} />}
    </Status>
  </div>
}
