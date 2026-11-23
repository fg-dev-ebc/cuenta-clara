import { randomUUID } from 'node:crypto'
import { getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { query } from './db.js'
import { day, normalize, notFound, paginated, pagination, slug, text, uuid } from './validation.js'

const branchColumns = `b.id, b.slug, b.name AS branch_name, b.zone, b.address, e.name, e.id AS establishment_id`
const statsJoin = `LEFT JOIN LATERAL (
  SELECT count(*)::int AS review_count, max(r.published_at) AS latest_review,
    coalesce(array_agg(DISTINCT c.name ORDER BY c.name), '{}') AS categories
  FROM reviews r JOIN categories c ON c.id = r.category_id
  WHERE r.branch_id = b.id AND r.status = 'published'
) stats ON true`

const imageColumn = `(SELECT ri.id FROM reviews r JOIN review_images ri ON ri.review_id = r.id
  WHERE r.branch_id = b.id AND r.status = 'published' ORDER BY r.published_at DESC, ri.created_at, ri.id LIMIT 1) AS image_id`

const searchExpression = `b.search_text LIKE '%' || replace(replace(replace(word, '!', '!!'), '%', '!%'), '_', '!_') || '%' ESCAPE '!'`

async function listBranches({ q = '', zone = '', category = '', page, sort = 'name' }) {
  const paging = pagination(page)
  const orderBy = {
    reviews: 'stats.review_count DESC, stats.latest_review DESC NULLS LAST, b.slug',
    views: 'v.view_count DESC, b.slug',
    name: 'e.name, b.name, b.slug',
  }[sort]
  const views = sort === 'views' ? `JOIN LATERAL (
    SELECT count(*)::int AS view_count FROM establishment_views ev
    WHERE ev.branch_id = b.id AND ev.view_day >= CURRENT_DATE - 29
    HAVING count(*) > 0
  ) v ON true` : ''
  const { rows } = await query(`
    SELECT ${branchColumns}, stats.*, ${imageColumn} ${sort === 'views' ? ', v.view_count' : ''}
    FROM branches b JOIN establishments e ON e.id = b.establishment_id
    ${statsJoin} ${views}
    WHERE b.status = 'active' AND ($2 = '' OR b.zone = $2)
      AND NOT EXISTS (SELECT 1 FROM unnest($1::text[]) AS words(word) WHERE NOT (${searchExpression}))
      AND ($3 = '' OR EXISTS (SELECT 1 FROM reviews r JOIN categories c ON c.id = r.category_id
        WHERE r.branch_id = b.id AND r.status = 'published' AND c.slug = $3))
      ${sort === 'reviews' ? 'AND stats.review_count > 0' : ''}
    ORDER BY ${orderBy} LIMIT $4 OFFSET $5`,
  [normalize(q).split(' ').filter(Boolean), zone, category, sort === 'name' ? paging.limit + 1 : 3, paging.offset])
  return paginated(rows, paging)
}

async function branchBySlug(key) {
  const { rows: [row] } = await query(`SELECT ${branchColumns} FROM branches b
    JOIN establishments e ON e.id = b.establishment_id WHERE b.slug = $1 AND b.status = 'active'`, [key])
  if (!row) throw notFound('No encontramos esa sucursal.')
  return row
}

export function directoryRoutes(app) {
  app.get('/api/categories', async (c) => {
    const { rows } = await query('SELECT id, slug, name, form_kind FROM categories WHERE active ORDER BY position, name')
    return c.json(rows)
  })
  app.get('/api/directory', async (c) => {
    const filters = z.object({ q: text(0, 120).default(''), zone: text(0, 100).default(''), category: slug.optional(), page: z.string().optional() }).parse(c.req.query())
    const [result, zones] = await Promise.all([
      listBranches(filters), query("SELECT DISTINCT zone FROM branches WHERE status = 'active' ORDER BY zone"),
    ])
    return c.json({ ...result, zones: zones.rows.map((row) => row.zone) })
  })
  app.get('/api/highlights', async (c) => {
    const [viewed, discussed] = await Promise.all([listBranches({ sort: 'views' }), listBranches({ sort: 'reviews' })])
    return c.json({ viewed: viewed.items, discussed: discussed.items })
  })
  app.get('/api/branches/:slug', async (c) => {
    const branch = await branchBySlug(slug.parse(c.req.param('slug')))
    const filters = z.object({ category: slug.optional(), from: day.optional(), to: day.optional(), page: z.string().optional() })
      .refine((data) => !data.from || !data.to || data.from <= data.to, 'El intervalo de fechas no es válido').parse(c.req.query())
    const paging = pagination(filters.page, 8)
    const [siblings, categories, stats, reviews] = await Promise.all([
      query("SELECT slug, name, zone FROM branches WHERE establishment_id = $1 AND status = 'active' ORDER BY name, zone", [branch.establishment_id]),
      query(`SELECT c.id, c.slug, c.name, count(r.id)::int AS review_count
        FROM categories c LEFT JOIN reviews r ON r.category_id = c.id AND r.branch_id = $1 AND r.status = 'published'
        GROUP BY c.id HAVING c.active OR count(r.id) > 0 ORDER BY c.position, c.name`, [branch.id]),
      query(`SELECT stats.review_count, stats.latest_review, ${imageColumn} FROM branches b ${statsJoin} WHERE b.id = $1`, [branch.id]),
      query(`SELECT r.id, r.title, r.description, r.visited_on::text, r.published_at, r.amount, r.currency, r.details,
          c.name AS category, p.alias, p.avatar_id, ARRAY(SELECT i.id FROM review_images i WHERE i.review_id = r.id ORDER BY i.created_at, i.id) AS image_ids
        FROM reviews r JOIN categories c ON c.id = r.category_id JOIN profiles p ON p.id = r.author_id
        WHERE r.branch_id = $1 AND r.status = 'published' AND ($2::text IS NULL OR c.slug = $2)
          AND ($3::date IS NULL OR r.visited_on >= $3) AND ($4::date IS NULL OR r.visited_on <= $4)
        ORDER BY r.published_at DESC, r.id LIMIT $5 OFFSET $6`,
      [branch.id, filters.category ?? null, filters.from ?? null, filters.to ?? null, paging.limit + 1, paging.offset]),
    ])
    return c.json({ branch: { ...branch, ...stats.rows[0] }, siblings: siblings.rows, categories: categories.rows, ...paginated(reviews.rows, paging) })
  })
  app.post('/api/branches/:slug/views', async (c) => {
    const branch = await branchBySlug(slug.parse(c.req.param('slug')))
    const cookie = uuid.safeParse(getCookie(c, 'cc_visit'))
    const visitor = cookie.success ? cookie.data : randomUUID()
    if (!cookie.success) setCookie(c, 'cc_visit', visitor, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/api', maxAge: 60 * 60 * 24 * 30 })
    await query('INSERT INTO establishment_views (branch_id, visitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [branch.id, visitor])
    return c.body(null, 204)
  })
}
