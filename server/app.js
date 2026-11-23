import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { ZodError } from 'zod'
import { adminRoutes } from './admin.js'
import { authProxyRoutes } from './auth-proxy.js'
import { contributionRoutes } from './contributions.js'
import { directoryRoutes } from './directory.js'
import { liveRoutes } from './live.js'
import { placesRoutes } from './places.js'
import { storageRoutes } from './storage.js'

export const app = new Hono()
app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin', referrerPolicy: 'strict-origin-when-cross-origin' }))
app.use('/api/*', bodyLimit({ maxSize: 24_000, onError: (c) => c.json({ error: 'El formulario supera el tamaño permitido.' }, 413) }))
app.get('/api/config', (c) => c.json({
  authUrl: process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET?.length >= 32 ? '/api/auth' : null,
  realtimeUrl: process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET ? process.env.NEON_REALTIME_URL : null,
  placesAvailable: Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
}))

authProxyRoutes(app)
directoryRoutes(app)
contributionRoutes(app)
placesRoutes(app)
storageRoutes(app)
liveRoutes(app)
adminRoutes(app)

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    const message = issue?.code === 'custom' && issue.message !== 'Invalid input' ? issue.message : 'Revisa los datos del formulario.'
    return c.json({ error: message, field: issue?.path.join('.') }, 422)
  }
  if (error.code === '23505') return c.json({ error: 'Ya existe un registro con esos datos.' }, 409)
  if (error.code === '23503') return c.json({ error: 'El registro asociado ya no está disponible.' }, 422)
  console.error(c.req.method, 'API error:', error.code || error.name, process.env.NODE_ENV === 'test' ? error.message : '')
  return c.json({ error: 'No pudimos completar la operación. Intenta de nuevo.' }, 500)
})
