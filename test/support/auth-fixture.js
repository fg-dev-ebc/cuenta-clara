import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { NEON_AUTH_SESSION_COOKIE_NAME } from '@neon/auth/server'

export async function authFixture(test) {
  const sessions = new Map()
  let lookups = 0
  const upstream = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/get-session?disableCookieCache=true') {
      res.writeHead(404).end()
      return
    }
    lookups++
    const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`))
    const user = sessions.get(cookie)
    const data = user ? { user, session: { userId: user.id, expiresAt: '2099-01-01T00:00:00.000Z' } } : null
    // A normal cookie session is valid even if the provider returns no JWT header.
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
  }).listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const old = process.env.NEON_AUTH_BASE_URL
  process.env.NEON_AUTH_BASE_URL = `http://127.0.0.1:${upstream.address().port}`
  test.after(() => {
    if (old === undefined) delete process.env.NEON_AUTH_BASE_URL
    else process.env.NEON_AUTH_BASE_URL = old
    upstream.close()
  })
  return {
    identity(name, emailVerified = true) {
      const id = randomUUID()
      const cookie = `${NEON_AUTH_SESSION_COOKIE_NAME}=${randomUUID()}`
      sessions.set(cookie, { id, name, emailVerified })
      return { cookie, id }
    },
    expire: ({ cookie }) => sessions.delete(cookie),
    lookups: () => lookups,
  }
}
