import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { ensureProfile, isAdmin, requireUser, requireVerified } from './auth.js'
import { bump, query, transaction } from './db.js'
import { cleanImages, consumeImages, discardImage, prepareImages, saveImages } from './storage.js'
import { branchData, conflict, json, notFound, paginated, pagination, parseDetails, placeId, reviewInput, text, uuid } from './validation.js'

const directInput = reviewInput.and(z.object({ branchId: uuid }))
const requestedInput = z.object({
  branch: z.union([z.strictObject({ placeId }), branchData.omit({ placeId: true }).strict()]),
  review: reviewInput,
})
const profileInput = z.strictObject({
  alias: text(2, 50).refine((value) => !value.includes('@'), 'No uses un correo como alias público.'),
  avatarUploadId: uuid.nullable().optional(),
})

export async function writeReview(db, user, input, { branchId = null, requestId = null, images }) {
  const { rows: [category] } = await db.query('SELECT form_kind FROM categories WHERE id = $1 AND active FOR SHARE', [input.categoryId])
  if (!category) throw notFound('La categoría ya no está disponible.')
  const details = parseDetails(category.form_kind, input.details)
  if (details.advertisedPrice !== undefined) details.advertisedCurrency = input.currency
  const { rows: [review] } = await db.query(
    `INSERT INTO reviews (branch_id, request_id, author_id, category_id, title, description, visited_on, amount, currency, details, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $11 = 'published' THEN now() END)
     RETURNING id, status`,
    [branchId, requestId, user.id, input.categoryId, input.title, input.description, input.visitedOn,
      input.amount ?? null, input.amount === undefined ? null : input.currency, details, branchId ? 'published' : 'pending'],
  )
  await saveImages(db, review.id, user, images)
  return review
}

async function submitWithImages(user, input, run) {
  const images = await prepareImages(user, input.uploads)
  let result
  try {
    result = await transaction(async (db) => {
      await ensureProfile(user, db)
      return run(db, images)
    })
  } catch (error) {
    await cleanImages(images)
    throw error
  }
  await cleanImages(images, !result.existingSlug)
  return result
}

export function contributionRoutes(app) {
  app.get('/api/account', requireUser, async (c) => {
    const user = c.get('user')
    if (user.verified) await ensureProfile(user)
    const { rows: [profile] } = await query('SELECT alias, avatar_id FROM profiles WHERE id = $1', [user.id])
    return c.json({ ...user, ...profile, admin: user.verified && await isAdmin(user.id) })
  })
  app.patch('/api/account/profile', requireUser, requireVerified, async (c) => {
    const user = c.get('user')
    const input = await json(c, profileInput)
    const images = input.avatarUploadId ? await prepareImages(user, [input.avatarUploadId], { avatar: true }) : []
    let result
    try {
      result = await transaction(async (db) => {
        await ensureProfile(user, db)
        const { rows: [old] } = await db.query('SELECT alias, avatar_id, avatar_key FROM profiles WHERE id = $1 FOR UPDATE', [user.id])
        const changingAvatar = input.avatarUploadId !== undefined
        const avatarId = changingAvatar ? images[0]?.objectId ?? null : old.avatar_id
        const avatarKey = changingAvatar ? images[0]?.key ?? null : old.avatar_key
        if (input.alias !== old.alias || avatarId !== old.avatar_id) {
          await consumeImages(db, user, images)
          await db.query('UPDATE profiles SET alias = $2, avatar_id = $3, avatar_key = $4 WHERE id = $1', [user.id, input.alias, avatarId, avatarKey])
          await bump(db, 'directory')
        }
        return { profile: { alias: input.alias, avatar_id: avatarId }, oldKey: avatarId !== old.avatar_id ? old.avatar_key : null }
      })
    } catch (error) {
      await cleanImages(images)
      throw error
    }
    await cleanImages(images, true)
    if (result.oldKey) await discardImage(result.oldKey)
    return c.json(result.profile)
  })
  app.get('/api/account/contributions', requireUser, async (c) => {
    const paging = pagination(c.req.query('page'))
    const { rows } = await query(`
      SELECT r.id, r.title, r.status, r.created_at, r.published_at, b.slug, b.name AS branch_name, e.name,
        er.proposed_name, er.branch_name AS proposed_branch, er.status AS request_status, er.reason,
        (er.place_id IS NOT NULL) AS proposed_with_google,
        (SELECT status FROM correction_requests cr WHERE cr.review_id = r.id AND cr.author_id = $1 ORDER BY cr.created_at DESC LIMIT 1) AS correction_status
      FROM reviews r LEFT JOIN branches b ON b.id = r.branch_id LEFT JOIN establishments e ON e.id = b.establishment_id
      LEFT JOIN establishment_requests er ON er.id = r.request_id
      WHERE r.author_id = $1 ORDER BY r.created_at DESC, r.id LIMIT $2 OFFSET $3`,
    [c.get('user').id, paging.limit + 1, paging.offset])
    return c.json(paginated(rows, paging))
  })
  app.post('/api/reviews', requireUser, requireVerified, async (c) => {
    const input = await json(c, directInput)
    const user = c.get('user')
    const result = await submitWithImages(user, input, async (db, images) => {
      const { rows: [branch] } = await db.query("SELECT slug FROM branches WHERE id = $1 AND status = 'active' FOR SHARE", [input.branchId])
      if (!branch) throw notFound('La sucursal no está disponible.')
      const review = await writeReview(db, user, input, { branchId: input.branchId, images })
      await bump(db, 'directory', `branch:${branch.slug}`, 'admin')
      return { ...review, slug: branch.slug }
    })
    return c.json(result, 201)
  })
  app.post('/api/requests', requireUser, requireVerified, async (c) => {
    const { branch, review } = await json(c, requestedInput)
    const user = c.get('user')
    const result = await submitWithImages(user, review, async (db, images) => {
      if (branch.placeId) {
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 480))', [`${user.id}:${branch.placeId}`])
        // An existing link is returned only for public fichas.
        const { rows: [existing] } = await db.query('SELECT slug, status FROM branches WHERE place_id = $1', [branch.placeId])
        if (existing) {
          if (existing.status !== 'active') throw conflict('Ya existe un registro para este lugar. Solicita una revisión al equipo.')
          return { existingSlug: existing.slug }
        }
        const { rowCount } = await db.query("SELECT 1 FROM establishment_requests WHERE place_id = $1 AND author_id = $2 AND status = 'pending'", [branch.placeId, user.id])
        if (rowCount) throw conflict('Ya tienes una solicitud pendiente para este lugar.')
      }
      const { rows: [request] } = await db.query(`
        INSERT INTO establishment_requests (author_id, establishment_id, proposed_name, branch_name, zone, address, place_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user.id, branch.establishmentId ?? null, branch.name ?? null, branch.branchName ?? null, branch.zone ?? null, branch.address ?? null, branch.placeId ?? null])
      await writeReview(db, user, review, { requestId: request.id, images })
      await bump(db, 'admin')
      return request
    })
    return c.json(result, result.existingSlug ? 200 : 201)
  })
  app.post('/api/reviews/:id/report', requireUser, requireVerified, async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const { message } = await json(c, z.object({ message: text(8, 600) }))
    const user = c.get('user')
    await transaction(async (db) => {
      await ensureProfile(user, db)
      const { rows: [review] } = await db.query(`SELECT r.author_id FROM reviews r JOIN branches b ON b.id = r.branch_id
        WHERE r.id = $1 AND r.status = 'published' AND b.status = 'active'`, [id])
      if (!review) throw notFound()
      if (review.author_id === user.id) throw new HTTPException(422, { message: 'Para tu propia reseña, solicita una corrección.' })
      const { rowCount } = await db.query(`INSERT INTO review_reports (review_id, author_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, user.id, message])
      if (!rowCount) throw conflict('Ya hay un reporte tuyo en revisión.')
      await bump(db, 'admin')
    })
    return c.json({ ok: true }, 201)
  })
  app.post('/api/reviews/:id/correction', requireUser, requireVerified, async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const { message } = await json(c, z.object({ message: text(8, 600) }))
    const user = c.get('user')
    await transaction(async (db) => {
      const { rowCount } = await db.query(`INSERT INTO correction_requests (review_id, author_id, message)
        SELECT id, author_id, $3 FROM reviews WHERE id = $1 AND author_id = $2 AND status = 'published'
        ON CONFLICT DO NOTHING`, [id, user.id, message])
      if (!rowCount) {
        const { rowCount: owned } = await db.query("SELECT 1 FROM reviews WHERE id = $1 AND author_id = $2 AND status = 'published'", [id, user.id])
        if (!owned) throw notFound()
        throw conflict('Ya hay una corrección en revisión.')
      }
      await bump(db, 'admin')
    })
    return c.json({ ok: true }, 201)
  })
}
