import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { requireUser, requireVerified } from '../server/auth.js'
import { authFixture } from './support/auth-fixture.js'

test('las rutas privadas reutilizan la sesión de Neon sin pedir un JWT al navegador', async (t) => {
  const auth = await authFixture(t)
  const app = new Hono()
  const payload = (c) => c.json(c.get('user'))
  app.get('/read', requireUser, payload)
  app.post('/write', requireUser, requireVerified, payload)
  const origin = 'http://localhost:5173'
  const verified = auth.identity('Alias de prueba')
  const unverified = auth.identity('No verificado', false)
  const run = (path, headers = {}, method = 'GET') => app.request(`${origin}${path}`, { method, headers })

  assert.equal((await run('/read')).status, 401)
  assert.equal(auth.lookups(), 0)
  assert.equal((await run('/write', { Cookie: verified.cookie, Origin: 'https://otra-web.example' }, 'POST')).status, 403)
  assert.equal(auth.lookups(), 0)
  const read = await run('/read', { Cookie: verified.cookie })
  assert.equal(read.status, 200)
  assert.deepEqual(await read.json(), { id: verified.id, alias: 'Alias de prueba', verified: true })
  assert.equal((await run('/write', { Cookie: verified.cookie, Origin: origin }, 'POST')).status, 200)
  const proxied = await app.request('http://localhost:3001/write', {
    method: 'POST', headers: { Cookie: verified.cookie, Origin: origin },
  })
  assert.equal(proxied.status, 200)
  const foreign = await app.request('http://localhost:3001/write', {
    method: 'POST', headers: { Cookie: verified.cookie, Origin: 'http://localhost:9900' },
  })
  assert.equal(foreign.status, 403)
  assert.equal((await run('/write', { Cookie: unverified.cookie, Origin: origin }, 'POST')).status, 403)
  auth.expire(verified)
  assert.equal((await run('/read', { Cookie: verified.cookie })).status, 401)
})
