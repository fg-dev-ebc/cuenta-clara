import { handleAuthProxyRequest } from '@neon/auth/server'
import { HTTPException } from 'hono/http-exception'

const publicMethods = new Map([
  ['get-session', new Set(['GET', 'POST'])],
  ['sign-up/email', new Set(['POST'])],
  ['sign-in/email', new Set(['POST'])],
  ['sign-in/social', new Set(['POST'])],
  ['sign-out', new Set(['POST'])],
  ['email-otp/verify-email', new Set(['POST'])],
  ['email-otp/send-verification-otp', new Set(['POST'])],
])

export function authProxyRoutes(app) {
  app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    const baseUrl = process.env.NEON_AUTH_BASE_URL
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
    if (!baseUrl || !cookieSecret || cookieSecret.length < 32) {
      throw new HTTPException(503, { message: 'El acceso a cuentas no está configurado.' })
    }
    const url = new URL(c.req.url)
    const path = url.pathname.slice('/api/auth/'.length)
    const method = c.req.method
    if (!publicMethods.get(path)?.has(method)) throw new HTTPException(404, { message: 'Ruta de acceso no disponible.' })
    if (c.req.header('sec-fetch-site') === 'cross-site') throw new HTTPException(403, { message: 'Solicitud de acceso no permitida.' })
    if (path === 'sign-in/social') {
      const body = await c.req.raw.clone().json().catch(() => null)
      if (body?.provider !== 'google') throw new HTTPException(422, { message: 'El proveedor de acceso no está disponible.' })
    }

    // Confirm the browser's session with Neon rather than serving a stale cached cookie.
    if (path === 'get-session') url.searchParams.set('disableCookieCache', 'true')
    const response = await handleAuthProxyRequest({
      request: new Request(url, c.req.raw),
      path,
      baseUrl: baseUrl.replace(/\/$/, ''),
      cookieSecret,
      sameSite: path === 'sign-in/social' ? 'lax' : 'strict',
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
}
