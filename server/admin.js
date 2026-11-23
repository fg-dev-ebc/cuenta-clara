import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireUser, requireVerified, requireAdmin } from './auth.js'
import { bump, query, transaction } from './db.js'
import { administrativeImage } from './storage.js'
import { getPlacesReference } from './places.js'
import { branchData, conflict, formKind, json, normalize, notFound, paginated, pagination, text, uuid } from './validation.js'

const safeSlug = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const audit = (db, c, action, type, id, message = null) => db.query(
  'INSERT INTO moderation_logs (admin_id, action, entity_type, entity_id, message) VALUES ($1, $2, $3, $4, $5)',
  [c.get('user').id, action, type, id, message],
)
const statusFilter = (c, values) => z.enum(['all', ...values]).parse(c.req.query('status') ?? values[0])
const searchText = (b) => normalize([b.name, b.branchName, b.zone, b.address].join(' '))
const categoryInput = z.object({
  name: text(2, 50), formKind, position: z.number().int().min(0).max(9999), active: z.boolean(),
})

async function storeBranch(db, input) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 481))', [normalize(input.name)])
  const { rows: [found] } = input.establishmentId
    ? await db.query('SELECT id, name FROM establishments WHERE id = $1 FOR UPDATE', [input.establishmentId])
    : await db.query('SELECT id, name FROM establishments WHERE lower(name) = lower($1) ORDER BY created_at LIMIT 1 FOR UPDATE', [input.name])
  if (input.establishmentId && !found) throw notFound('No encontramos el establecimiento seleccionado.')
  const parent = found ?? (await db.query('INSERT INTO establishments (name) VALUES ($1) RETURNING id, name', [input.name])).rows[0]
  const data = { ...input, name: parent.name }
  const search = searchText(data)
  const { rowCount } = await db.query(`SELECT id FROM branches WHERE establishment_id = $1 AND search_text = $2
    OR (place_id = $3 AND $3 IS NOT NULL)`, [parent.id, search, input.placeId ?? null])
  if (rowCount) throw conflict('Ya existe una ficha equivalente. Vincula la solicitud a esa sucursal.')
  const slug = `${(safeSlug(`${parent.name} ${input.branchName}`) || 'sucursal').slice(0, 100).replace(/-$/, '')}-${randomUUID().slice(0, 8)}`
  const { rows: [branch] } = await db.query(`INSERT INTO branches (establishment_id, slug, name, zone, address, place_id, search_text)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, slug`,
  [parent.id, slug, input.branchName, input.zone, input.address, input.placeId ?? null, search])
  return branch
}

export function adminRoutes(app) {
  app.use('/api/admin/*', requireUser, requireVerified, requireAdmin)
  app.get('/api/admin/images/:id', administrativeImage)

  app.get('/api/admin/dashboard', async (c) => {
    const [metrics, logs] = await Promise.all([
      query(`SELECT
        (SELECT count(*)::int FROM establishments) AS establishments,
        (SELECT count(*)::int FROM branches) AS branches,
        (SELECT count(*)::int FROM reviews WHERE status = 'published') AS reviews,
        (SELECT count(*)::int FROM establishment_requests WHERE status = 'pending') AS pending,
        (SELECT count(*)::int FROM establishment_requests WHERE status = 'rejected') AS rejected,
        (SELECT count(*)::int FROM review_reports WHERE status = 'pending') AS reports,
        (SELECT count(*)::int FROM correction_requests WHERE status = 'pending') AS corrections`),
      query('SELECT id, action, entity_type, message, created_at FROM moderation_logs ORDER BY created_at DESC LIMIT 15'),
    ])
    return c.json({ metrics: metrics.rows[0], logs: logs.rows })
  })

  app.get('/api/admin/branches', async (c) => {
    const paging = pagination(c.req.query('page'))
    const q = normalize(text(0, 120).parse(c.req.query('q') ?? ''))
    const { rows } = await query(`SELECT b.id, b.slug, b.name AS branch_name, b.zone, b.address, b.place_id, b.status,
      e.name, e.id AS establishment_id FROM branches b JOIN establishments e ON e.id = b.establishment_id
      WHERE strpos(b.search_text, $1) > 0 OR $1 = '' ORDER BY e.name, b.name, b.slug LIMIT $2 OFFSET $3`,
    [q, paging.limit + 1, paging.offset])
    return c.json(paginated(rows, paging))
  })
  app.post('/api/admin/branches', async (c) => {
    const data = await json(c, branchData)
    const result = await transaction(async (db) => {
      const branch = await storeBranch(db, data)
      await audit(db, c, 'Sucursal registrada', 'branch', branch.id)
      await bump(db, 'directory', 'admin')
      return branch
    })
    return c.json(result, 201)
  })
  app.patch('/api/admin/branches/:id', async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const input = await json(c, branchData.omit({ establishmentId: true, name: true }).extend({
      name: text(2, 120).optional(), status: z.enum(['active', 'inactive']),
    }))
    await transaction(async (db) => {
      const { rows: [row] } = await db.query(`SELECT b.slug, e.id AS establishment_id, e.name FROM branches b
        JOIN establishments e ON e.id = b.establishment_id WHERE b.id = $1 FOR UPDATE OF e, b`, [id])
      if (!row) throw notFound()
      if (input.name && input.name !== row.name) {
        await db.query('UPDATE establishments SET name = $1 WHERE id = $2', [input.name, row.establishment_id])
        const { rows: siblings } = await db.query('SELECT id, name, zone, address FROM branches WHERE establishment_id = $1 AND id <> $2', [row.establishment_id, id])
        for (const sibling of siblings) {
          await db.query('UPDATE branches SET search_text = $1, updated_at = now() WHERE id = $2', [
            searchText({ ...sibling, name: input.name, branchName: sibling.name }), sibling.id,
          ])
        }
      }
      await db.query(`UPDATE branches SET name = $1, zone = $2, address = $3, status = $4, search_text = $5, updated_at = now()
        WHERE id = $6`, [input.branchName, input.zone, input.address, input.status, searchText({ ...input, name: input.name ?? row.name }), id])
      await audit(db, c, 'Sucursal actualizada', 'branch', id)
      await bump(db, 'directory', `branch:${row.slug}`, 'admin')
    })
    return c.json({ ok: true })
  })

  app.get('/api/admin/requests', async (c) => {
    const status = statusFilter(c, ['pending', 'approved', 'rejected', 'linked'])
    const paging = pagination(c.req.query('page'))
    const { rows } = await query(`SELECT er.id, er.proposed_name, er.branch_name, er.zone, er.status, er.created_at, p.alias,
      (er.place_id IS NOT NULL) AS proposed_with_google
      FROM establishment_requests er JOIN profiles p ON p.id = er.author_id
      WHERE ($1 = 'all' OR er.status = $1) ORDER BY er.created_at DESC, er.id LIMIT $2 OFFSET $3`,
    [status, paging.limit + 1, paging.offset])
    return c.json(paginated(rows, paging))
  })
  app.get('/api/admin/requests/:id', async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const { rows: [request] } = await query(`SELECT er.id, er.establishment_id, er.proposed_name, er.branch_name, er.zone,
      er.address, er.place_id, er.status, er.reason, er.created_at, p.alias,
      r.id AS review_id, r.title, r.description, r.visited_on::text, r.amount, r.currency, r.details, cat.name AS category,
      ARRAY(SELECT i.id FROM review_images i WHERE i.review_id = r.id ORDER BY i.created_at, i.id) AS image_ids
      FROM establishment_requests er JOIN profiles p ON p.id = er.author_id
      JOIN reviews r ON r.request_id = er.id JOIN categories cat ON cat.id = r.category_id WHERE er.id = $1`, [id])
    if (!request) throw notFound()
    const { rows: duplicates } = await query(`SELECT b.id, b.slug, b.name AS branch_name, b.zone, e.name, b.address, b.status
      FROM branches b JOIN establishments e ON e.id = b.establishment_id
      WHERE b.place_id = $1 OR b.establishment_id = $2 OR similarity(b.search_text, $3) > 0.26 OR lower(e.name) = lower($4)
      ORDER BY (b.place_id IS NOT NULL AND b.place_id = $1) DESC NULLS LAST, similarity(b.search_text, $3) DESC LIMIT 8`,
    [request.place_id, request.establishment_id, normalize([request.proposed_name, request.branch_name, request.zone, request.address].filter(Boolean).join(' ')), request.proposed_name])
    return c.json({ ...request, duplicates })
  })
  app.get('/api/admin/requests/:id/places-reference', async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const { rows: [record] } = await query('SELECT place_id FROM establishment_requests WHERE id = $1', [id])
    if (!record?.place_id) throw notFound('La solicitud no tiene una referencia de Google Places.')
    return c.json(await getPlacesReference(record.place_id))
  })
  app.post('/api/admin/requests/:id/resolve', async (c) => {
    const id = uuid.parse(c.req.param('id'))
    const action = await json(c, z.discriminatedUnion('action', [
      z.object({ action: z.literal('approve'), branch: branchData }),
      z.object({ action: z.literal('reject'), reason: text(8, 600) }),
      z.object({ action: z.literal('link'), branchId: uuid }),
    ]))
    const result = await transaction(async (db) => {
      const { rows: [request] } = await db.query('SELECT status, place_id FROM establishment_requests WHERE id = $1 FOR UPDATE', [id])
      if (!request) throw notFound()
      if (request.status !== 'pending') throw conflict('La solicitud ya se resolvió.')
      let branch
      let reason = null
      if (action.action === 'approve') {
        branch = await storeBranch(db, { ...action.branch, placeId: action.branch.placeId ?? request.place_id ?? undefined })
      } else if (action.action === 'link') {
        const { rows } = await db.query("SELECT id, slug FROM branches WHERE id = $1 AND status = 'active' FOR SHARE", [action.branchId])
        branch = rows[0]
        if (!branch) throw notFound('Selecciona una sucursal activa.')
      } else {
        reason = action.reason
      }
      const state = { approve: 'approved', link: 'linked', reject: 'rejected' }[action.action]
      await db.query(`UPDATE establishment_requests SET status = $2, resolved_branch_id = $3, reason = $4, resolved_at = now()
        WHERE id = $1`, [id, state, branch?.id ?? null, reason])
      if (branch) {
        await db.query(`UPDATE reviews SET branch_id = $2,
          status = CASE WHEN status = 'pending' THEN 'published' ELSE status END,
          published_at = CASE WHEN status = 'pending' THEN now() ELSE published_at END WHERE request_id = $1`, [id, branch.id])
      }
      await audit(db, c, { approve: 'Alta aprobada', link: 'Alta vinculada', reject: 'Alta rechazada' }[action.action], 'request', id, reason)
      await bump(db, 'admin', ...(branch ? ['directory', `branch:${branch.slug}`] : []))
      return { status: state, slug: branch?.slug }
    })
    return c.json(result)
  })

  app.get('/api/admin/categories', async (c) => {
    const { rows } = await query('SELECT id, name, slug, form_kind, position, active FROM categories ORDER BY position, name')
    return c.json(rows)
  })
  const writeCategory = async (c) => {
    const id = c.req.param('id') && uuid.parse(c.req.param('id'))
    const input = await json(c, categoryInput)
    const { name, formKind: kind, position, active } = input
    const result = await transaction(async (db) => {
      const { rows: [category] } = id
        ? await db.query(`UPDATE categories SET name = $1, form_kind = $2, position = $3, active = $4 WHERE id = $5 RETURNING id`,
          [name, kind, position, active, id])
        : await db.query(`INSERT INTO categories (name, form_kind, position, active, slug) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [name, kind, position, active, safeSlug(name) || `categoria-${randomUUID().slice(0, 8)}`])
      if (!category) throw notFound()
      await audit(db, c, id ? 'Categoría actualizada' : 'Categoría creada', 'category', category.id)
      await bump(db, 'directory', 'admin')
      return category
    })
    return c.json(result, id ? 200 : 201)
  }
  app.post('/api/admin/categories', writeCategory)
  app.patch('/api/admin/categories/:id', writeCategory)

  for (const [resource, table, messageColumn, states] of [
    ['reports', 'review_reports', 'reason', ['pending', 'resolved', 'dismissed']],
    ['corrections', 'correction_requests', 'message', ['pending', 'accepted', 'rejected']],
  ]) {
    app.get(`/api/admin/${resource}`, async (c) => {
      const status = statusFilter(c, states)
      const paging = pagination(c.req.query('page'))
      const { rows } = await query(`SELECT t.id, t.review_id, t.status, t.${messageColumn} AS message, t.resolution, t.created_at,
        r.title, r.description, r.visited_on::text, r.status AS review_status, p.alias, b.slug,
        ARRAY(SELECT i.id FROM review_images i WHERE i.review_id = r.id ORDER BY i.created_at, i.id) AS image_ids
        FROM ${table} t JOIN reviews r ON r.id = t.review_id JOIN profiles p ON p.id = t.author_id
        LEFT JOIN branches b ON b.id = r.branch_id WHERE ($1 = 'all' OR t.status = $1)
        ORDER BY t.created_at DESC, t.id LIMIT $2 OFFSET $3`, [status, paging.limit + 1, paging.offset])
      return c.json(paginated(rows, paging))
    })
    app.post(`/api/admin/${resource}/:id/resolve`, async (c) => {
      const id = uuid.parse(c.req.param('id'))
      const input = await json(c, z.object({
        status: z.enum(states.slice(1)), resolution: text(8, 600),
        visibility: z.enum(['unchanged', 'hidden', 'removed']).default('unchanged'),
        title: text(4, 100).optional(), description: text(15, 3000).optional(),
      }))
      await transaction(async (db) => {
        const { rows: [item] } = await db.query(`SELECT status, review_id FROM ${table} WHERE id = $1 FOR UPDATE`, [id])
        if (!item) throw notFound()
        if (item.status !== 'pending') throw conflict('El registro ya se resolvió.')
        const { rows: [review] } = await db.query(`SELECT r.title, r.description, r.status, b.slug FROM reviews r
          LEFT JOIN branches b ON b.id = r.branch_id WHERE r.id = $1 FOR UPDATE OF r`, [item.review_id])
        await db.query(`UPDATE ${table} SET status = $1, resolution = $2, resolved_at = now() WHERE id = $3`, [input.status, input.resolution, id])
        if (input.visibility !== 'unchanged' && review.status !== 'removed') {
          await db.query('UPDATE reviews SET status = $1 WHERE id = $2', [input.visibility, item.review_id])
          await audit(db, c, input.visibility === 'hidden' ? 'Reseña oculta' : 'Reseña retirada', 'review', item.review_id, input.resolution)
        }
        if (resource === 'corrections' && input.status === 'accepted' && (input.title || input.description)) {
          await db.query('UPDATE reviews SET title = coalesce($1, title), description = coalesce($2, description) WHERE id = $3',
            [input.title ?? null, input.description ?? null, item.review_id])
          await audit(db, c, 'Corrección aplicada', 'review', item.review_id, input.resolution)
        }
        await audit(db, c, resource === 'reports' ? 'Reporte resuelto' : 'Corrección revisada', resource, id, input.resolution)
        await bump(db, 'admin', ...(review.slug ? ['directory', `branch:${review.slug}`] : []))
      })
      return c.json({ ok: true })
    })
  }
}
