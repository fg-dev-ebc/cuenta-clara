import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize, paginated, pagination, parseDetails, reviewInput } from '../server/validation.js'

test('normaliza búsqueda en español y páginas de tamaño fijo', () => {
  assert.equal(normalize('  Café  MÉXICO '), 'cafe mexico')
  assert.deepEqual(paginated(['a', 'b', 'c'], pagination('3', 2)), { items: ['a', 'b'], page: 3, hasNext: true, offset: 4 })
  assert.throws(() => pagination('0'))
})

test('valida datos específicos por categoría y no acepta campos ajenos', () => {
  assert.deepEqual(parseDetails('buffet', { advertisedPrice: 200, conditions: 'Solo entre semana' }), {
    advertisedPrice: 200, conditions: 'Solo entre semana',
  })
  assert.throws(() => parseDetails('parking', { percentage: 15 }))
  assert.throws(() => parseDetails('tip', { percentage: 150 }))
})

test('rechaza fechas futuras, importes sin moneda y adjuntos repetidos', () => {
  const id = 'ed82efde-58cf-4af7-89f8-a50b66cecef0'
  const base = { categoryId: id, title: 'Detalle de la visita', description: 'Una descripción para verificar.', visitedOn: '2025-01-01' }
  assert.equal(reviewInput.safeParse(base).success, true)
  assert.equal(reviewInput.safeParse({ ...base, visitedOn: '2999-01-01' }).success, false)
  assert.equal(reviewInput.safeParse({ ...base, amount: 200 }).success, false)
  assert.equal(reviewInput.safeParse({ ...base, uploads: [id, id] }).success, false)
})
