import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import sharp from 'sharp'
import { app } from '../server/app.js'
import { database, query } from '../server/db.js'
import { authFixture } from './support/auth-fixture.js'

const sandbox = Boolean(process.env.NEON_BRANCH?.startsWith('verify-') && process.env.DATABASE_URL)

test('API y Neon aislados: altas, reseñas, permisos, imágenes y moderación', { skip: !sandbox }, async (t) => {
  const { identity } = await authFixture(t)
  t.after(() => database().end())
  process.env.NODE_ENV = 'test'

  const [admin, author, reader, unverified] = [
    identity('Administración'), identity('Autor de prueba'), identity('Lector de prueba'), identity('Sin verificación', false),
  ]
  const origin = 'http://localhost:5173'
  async function call(path, status = 200, actor, body, method = body === undefined ? 'GET' : 'POST') {
    const result = await app.request(`${origin}/api${path}`, {
      method,
      headers: { Origin: origin, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(actor ? { Cookie: actor.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = result.headers.get('content-type')?.includes('application/json') ? await result.json() : null
    assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(data)}`)
    return data ?? result
  }

  const categories = await call('/categories')
  assert.equal(categories.length, 11)
  const categoryId = categories.find(({ slug }) => slug === 'buffet').id
  await call('/admin/dashboard', 401)
  await call('/admin/dashboard', 403, reader)
  await call('/account', 200, admin)
  await query('INSERT INTO administrators (user_id) VALUES ($1)', [admin.id])

  const name = `Café Verificación ${randomUUID().slice(0, 6)}`
  const branch = { name, branchName: 'Centro', zone: 'Centro', address: 'Referencia de prueba' }
  const base = { categoryId, title: 'Condiciones del buffet', description: 'El precio reportado fue diferente al anunciado.', visitedOn: '2026-01-01',
    amount: 220, currency: 'MXN', details: { advertisedPrice: 200 } }
  await call('/requests', 403, unverified, { branch, review: base })
  const pending = await call('/requests', 201, author, { branch, review: base })
  assert.equal((await call(`/directory?q=${encodeURIComponent(name)}`)).items.length, 0)
  await call(`/admin/requests/${pending.id}`, 403, author)
  const record = await call(`/admin/requests/${pending.id}`, 200, admin)
  assert.equal(record.title, base.title)
  const approved = await call(`/admin/requests/${pending.id}/resolve`, 200, admin, { action: 'approve', branch })
  await call(`/admin/requests/${pending.id}/resolve`, 409, admin, { action: 'approve', branch })
  const publicResult = await call(`/branches/${approved.slug}?category=buffet`)
  assert.equal(publicResult.items[0].title, base.title)
  assert.equal(publicResult.items[0].amount, '220.00')
  assert.deepEqual(publicResult.items[0].details, { advertisedPrice: 200, advertisedCurrency: 'MXN' })
  const accentless = name.replace('é', 'e')
  assert.equal((await call(`/directory?q=${encodeURIComponent(accentless)}&zone=Centro`)).items[0].slug, approved.slug)
  assert.equal((await call(`/branches/${approved.slug}?from=2026-01-02`)).items.length, 0)
  const recordedView = await call(`/branches/${approved.slug}/views`, 204, undefined, undefined, 'POST')
  const cookie = recordedView.headers.get('set-cookie').split(';')[0]
  const recap = await app.request(`/api/branches/${approved.slug}/views`, { method: 'POST', headers: { Cookie: cookie } })
  assert.equal(recap.status, 204)
  assert.equal((await call('/highlights')).viewed.find((item) => item.slug === approved.slug).view_count, 1)

  const image = await sharp({ create: { width: 40, height: 40, channels: 3, background: 'white' } }).png().toBuffer()
  async function uploadImage() {
    const upload = await call('/uploads', 201, author, { type: 'image/png', size: image.length })
    const data = new FormData()
    for (const [name, value] of Object.entries(upload.fields)) data.set(name, value)
    data.set('file', new Blob([image], { type: 'image/png' }), 'test.png')
    const uploaded = await fetch(upload.url, { method: 'POST', body: data })
    assert.ok(uploaded.ok, `Neon Object Storage POST: ${uploaded.status}`)
    return upload.id
  }
  const avatarUploadId = await uploadImage()
  await call('/account/profile', 422, reader, { alias: 'Lector', avatarUploadId }, 'PATCH')
  await call('/account/profile', 422, author, { alias: 'Mi alias', id: reader.id }, 'PATCH')
  const profile = await call('/account/profile', 200, author, { alias: 'Alias renovado', avatarUploadId }, 'PATCH')
  assert.ok(profile.avatar_id)
  assert.equal((await call('/account', 200, author)).alias, 'Alias renovado')
  const withAvatar = (await call(`/branches/${approved.slug}`)).items[0]
  assert.equal(withAvatar.alias, profile.alias)
  assert.equal(withAvatar.avatar_id, profile.avatar_id)
  const avatarRoute = `/avatars/${profile.avatar_id}`
  assert.match((await fetch((await call(avatarRoute, 302)).headers.get('location'))).headers.get('content-type'), /^image\/webp/)
  await call('/account/profile', 200, author, { alias: profile.alias, avatarUploadId: null }, 'PATCH')
  await call(avatarRoute, 404)

  const published = await call('/reviews', 201, author, {
    ...base, branchId: publicResult.branch.id, title: 'Publicación automática', uploads: [await uploadImage()],
  })
  const reviewed = (await call(`/branches/${approved.slug}`)).items.find((item) => item.id === published.id)
  assert.equal(reviewed.image_ids.length, 1)
  const imageRoute = `/images/${reviewed.image_ids[0]}`
  const getImage = await call(imageRoute, 302)
  assert.match((await fetch(getImage.headers.get('location'))).headers.get('content-type'), /^image\/webp/)
  await call(`/reviews/${published.id}/correction`, 404, reader, { message: 'Intenta corregir una reseña ajena.' })
  await call(`/reviews/${published.id}/correction`, 201, author, { message: 'Ajustar el título con más contexto.' })
  await call(`/reviews/${published.id}/report`, 201, reader, { message: 'Esto es un reporte de verificación.' })
  const inbox = await call('/admin/reports', 200, admin)
  const report = inbox.items.find((item) => item.review_id === published.id)
  await call(`/admin/reports/${report.id}/resolve`, 200, admin, { status: 'resolved', resolution: 'Prueba de moderación posterior.', visibility: 'hidden' })
  await call(imageRoute, 404)
  assert.equal((await call(`/branches/${approved.slug}`)).items.some(({ id }) => id === published.id), false)

  const duplicate = await call('/requests', 201, reader, { branch, review: { ...base, title: 'Otra visita a la misma sucursal' } })
  await call(`/admin/requests/${duplicate.id}/resolve`, 409, admin, { action: 'approve', branch })
  const linked = await call(`/admin/requests/${duplicate.id}/resolve`, 200, admin, { action: 'link', branchId: publicResult.branch.id })
  assert.equal(linked.slug, approved.slug)
  const rejected = await call('/requests', 201, author, { branch: { ...branch, branchName: 'Sin ubicación' }, review: base })
  await call(`/admin/requests/${rejected.id}/resolve`, 200, admin, { action: 'reject', reason: 'La ubicación no se pudo identificar.' })
  assert.equal((await call('/account/contributions', 200, author)).items.find((item) => item.request_status === 'rejected').reason, 'La ubicación no se pudo identificar.')

  const placeId = `verificacion-${randomUUID()}`
  await call('/requests', 422, author, { branch: { placeId, address: 'Dirección ajena' }, review: base })
  const selected = await call('/requests', 201, author, { branch: { placeId }, review: base })
  const onHold = await call(`/admin/requests/${selected.id}`, 200, admin)
  assert.equal(onHold.place_id, placeId)
  assert.equal(onHold.proposed_name, null)
  assert.equal(onHold.address, null)
  await call(`/admin/requests/${selected.id}/resolve`, 422, admin, { action: 'approve', branch: { name } })
  const moderated = await call(`/admin/requests/${selected.id}/resolve`, 200, admin, {
    action: 'approve', branch: { ...branch, name: `Nueva sucursal ${randomUUID().slice(0, 6)}`, address: 'Referencia de moderación' },
  })
  assert.equal((await call(`/branches/${moderated.slug}`)).items[0].title, base.title)
  assert.equal((await call(`/directory?q=${encodeURIComponent(name)}`)).items.length, 1)
})
