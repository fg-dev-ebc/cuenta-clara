import pg from 'pg'

let pool

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada')
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL)
    if (url.searchParams.get('sslmode') === 'require') url.searchParams.set('sslmode', 'verify-full')
    pool = new pg.Pool({ connectionString: url.href, max: 8, connectionTimeoutMillis: 5000 })
    pool.on('error', (error) => console.error('Conexión PostgreSQL inactiva:', error.code || error.name))
  }
  return pool
}

export const query = (sql, args) => database().query(sql, args)

export async function transaction(run) {
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function bump(client, ...keys) {
  if (!keys.length) return
  return client.query(
    `INSERT INTO live_revisions (id)
     SELECT DISTINCT id FROM unnest($1::text[]) AS data(id) ORDER BY id
     ON CONFLICT (id) DO UPDATE SET version = live_revisions.version + 1`, [keys],
  )
}
