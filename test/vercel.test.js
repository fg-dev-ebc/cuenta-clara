import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/handler.js'

test('la función de Vercel enruta la URL original o la de destino sin exponer secretos', async () => {
  const base = 'https://cuenta-clara-hackathon.vercel.app'
  for (const path of ['/api/config', '/api/handler?__cc_api_path=config']) {
    const response = await handler.fetch(new Request(`${base}${path}`))
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(await response.json()).sort(), ['authUrl', 'placesAvailable', 'realtimeUrl'])
  }
  const protectedResponse = await handler.fetch(new Request(`${base}/api/handler?__cc_api_path=account%2Fcontributions`, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  }))
  assert.ok([403, 503].includes(protectedResponse.status))
  const unknown = await handler.fetch(new Request(`${base}/api/no-existe`))
  assert.equal(unknown.status, 404)
  assert.equal((await unknown.json()).error, 'Ruta no encontrada.')
})
