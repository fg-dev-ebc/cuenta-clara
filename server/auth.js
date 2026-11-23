import { extractNeonAuthCookies, handleAuthRequest, NEON_AUTH_SESSION_COOKIE_NAME } from '@neon/auth/server'
import { HTTPException } from 'hono/http-exception'
import { query } from './db.js'
import { uuid } from './validation.js'

const developmentOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export async function requireUser(c, next) {
  c.header('Cache-Control', 'no-store')
  const base = process.env.NEON_AUTH_BASE_URL
  if (!base) throw new HTTPException(503, { message: 'El acceso a cuentas no está configurado.' })

  const incoming = new URL(c.req.url)
  const configured = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : null
  const expectedOrigin = configured ?? incoming.origin
  const browserOrigin = c.req.header('origin')
  const fromDevelopmentProxy = !configured && process.env.NODE_ENV !== 'production' &&
    loopbackHosts.has(incoming.hostname) && developmentOrigins.has(browserOrigin)
  if (c.req.header('sec-fetch-site') === 'cross-site' ||
    (!['GET', 'HEAD'].includes(c.req.method) && browserOrigin !== expectedOrigin && !fromDevelopmentProxy)) {
    throw new HTTPException(403, { message: 'La solicitud debe enviarse desde Cuenta Clara.' })
  }

  const cookies = extractNeonAuthCookies(c.req.raw.headers)
  if (!cookies.split(';').some((cookie) => cookie.trimStart().startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`))) {
    throw new HTTPException(401, { message: 'Inicia sesión para continuar.' })
  }
  // Validate the actual first-party session with Neon, not a browser-issued token.
  const origin = fromDevelopmentProxy ? browserOrigin : expectedOrigin
  const sessionRequest = new Request(`${origin}/api/auth/get-session?disableCookieCache=true`, {
    headers: { Cookie: cookies, Origin: origin },
  })
  const response = await handleAuthRequest(base.replace(/\/$/, ''), sessionRequest, 'get-session')
  if (!response.ok && response.status !== 401) {
    throw new HTTPException(503, { message: 'No pudimos comprobar tu sesión. Intenta de nuevo.' })
  }
  const data = response.ok ? await response.json().catch(() => null) : null
  const id = uuid.safeParse(data?.user?.id)
  if (!data?.session || !id.success || data.user.banned === true || data.session.userId !== id.data) {
    throw new HTTPException(401, { message: 'Tu sesión no es válida. Vuelve a iniciar sesión.' })
  }
  const name = typeof data.user.name === 'string' ? data.user.name.trim().slice(0, 50) : ''
  c.set('user', { id: id.data, alias: name.length > 1 && !name.includes('@') ? name : 'Visitante', verified: data.user.emailVerified === true })
  await next()
}

export async function ensureProfile(user, client = { query }) {
  await client.query('INSERT INTO profiles (id, alias) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, user.alias])
}

export async function requireVerified(c, next) {
  if (!c.get('user').verified) throw new HTTPException(403, { message: 'Verifica tu correo antes de continuar.' })
  await next()
}

export async function isAdmin(userId) {
  const { rowCount } = await query('SELECT 1 FROM administrators WHERE user_id = $1', [userId])
  return rowCount > 0
}

export async function requireAdmin(c, next) {
  if (!(await isAdmin(c.get('user').id))) throw new HTTPException(403, { message: 'No tienes acceso a administración.' })
  await next()
}
