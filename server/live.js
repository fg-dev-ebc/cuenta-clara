import { createRealtime, rawSql, pgParam } from '@neon/realtime/server'
import { HTTPException } from 'hono/http-exception'
import { requireAdmin, requireUser, requireVerified } from './auth.js'
import { slug } from './validation.js'

let sdk

async function seal(c, statement, params) {
  const secret = process.env.NEON_REALTIME_SECRET
  if (!secret || !process.env.NEON_REALTIME_URL || !process.env.DATABASE_URL) {
    throw new HTTPException(503, { message: 'La sincronización en vivo no está disponible.' })
  }
  const db = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1))
  sdk ??= createRealtime({ secret, db })
  c.header('Cache-Control', 'no-store')
  return c.json(await sdk.seal({ query: rawSql(statement, params) }))
}

export function liveRoutes(app) {
  app.get('/api/live/directory', (c) => seal(c, "SELECT id, version FROM live_revisions WHERE id = 'directory'", []))
  app.get('/api/live/branches/:slug', (c) => seal(c, "SELECT id, version FROM live_revisions WHERE id = $1 OR id = 'directory'", [
    `branch:${slug.parse(c.req.param('slug'))}`,
  ]))
  app.get('/api/live/admin', requireUser, requireVerified, requireAdmin, (c) => seal(c, `SELECT live_revisions.id, live_revisions.version
    FROM live_revisions CROSS JOIN administrators WHERE live_revisions.id = 'admin' AND administrators.user_id = $1`,
  [pgParam.text('uuid', c.get('user').id)]))
}
