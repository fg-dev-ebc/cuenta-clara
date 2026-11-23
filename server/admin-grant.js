import { database, query } from './db.js'
import { uuid } from './validation.js'

try {
  const id = uuid.parse(process.argv[2])
  const { rowCount } = await query(
    `INSERT INTO administrators (user_id)
     SELECT id FROM profiles WHERE id = $1
     ON CONFLICT DO NOTHING`, [id],
  )
  console.log(rowCount ? 'Usuario autorizado como administrador.' : 'Ya está autorizado o aún no existe su perfil.')
} catch (error) {
  console.error('No se pudo autorizar. Usa un UUID de Neon Auth válido y comprueba la conexión.')
  process.exitCode = 1
} finally {
  if (process.env.DATABASE_URL) await database().end()
}
