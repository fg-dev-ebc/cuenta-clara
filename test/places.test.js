import assert from 'node:assert/strict'
import test from 'node:test'
import { placesFailure } from '../server/places.js'

test('Places distingue una clave inválida sin exponer mensajes crudos del proveedor', async () => {
  const upstream = Response.json({
    error: { message: 'Detalle interno de Google', details: [{ reason: 'API_KEY_INVALID' }] },
  }, { status: 400 })
  const error = await placesFailure(upstream)
  assert.equal(error.status, 503)
  assert.match(error.message, /Google rechazó la clave/)
  assert.doesNotMatch(error.message, /Detalle interno/)
})

test('Places distingue cuota agotada de un fallo de conexión', async () => {
  assert.equal((await placesFailure(new Response(null, { status: 429 }))).status, 429)
  assert.equal((await placesFailure(null)).status, 502)
})
