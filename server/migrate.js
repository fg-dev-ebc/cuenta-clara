import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { database, transaction } from './db.js'

const folder = new URL('../db/', import.meta.url)
const files = (await readdir(folder)).filter((name) => /^\d+-.+\.sql$/.test(name)).sort()
if (process.env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED

try {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(231707101)')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations
      (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`)
    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations')
    const previous = new Map(rows.map(({ name, checksum }) => [name, checksum]))
    for (const name of files) {
      const sql = (await readFile(new URL(name, folder), 'utf8')).replace(/\r\n/g, '\n')
      const checksum = createHash('sha256').update(sql).digest('hex')
      if (previous.has(name)) {
        if (previous.get(name) !== checksum) throw new Error(`Cambió una migración ya aplicada: ${name}`)
        continue
      }
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum])
      console.log(`Aplicada: ${name}`)
    }
  })
} catch (error) {
  console.error('No se pudo migrar:', error.code || error.message)
  process.exitCode = 1
} finally {
  if (process.env.DATABASE_URL) await database().end()
}
