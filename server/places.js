import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { ensureProfile, requireUser, requireVerified } from './auth.js'
import { query } from './db.js'
import { json, placeId, text } from './validation.js'

const unavailable = 'Google Places no pudo responder. Intenta de nuevo o usa el alta manual.'
const configurationErrors = new Map([
  ['API_KEY_INVALID', 'Google rechazó la clave de Places configurada.'],
  ['API_KEY_SERVICE_BLOCKED', 'La clave configurada no tiene permiso para usar Places API (New).'],
  ['API_KEY_IP_ADDRESS_BLOCKED', 'La clave de Places no está autorizada para la IP del servidor.'],
  ['API_KEY_HTTP_REFERRER_BLOCKED', 'La clave de Places tiene una restricción de sitio web incompatible con el servidor.'],
  ['SERVICE_DISABLED', 'Places API (New) no está habilitada en el proyecto de Google Cloud.'],
  ['BILLING_DISABLED', 'La facturación de Google Cloud no está habilitada para Places.'],
])

export async function placesFailure(response) {
  if (!response) return new HTTPException(502, { message: unavailable })
  const payload = await response.json().catch(() => null)
  const details = payload?.error?.details
  const reason = Array.isArray(details) ? details.find((detail) => configurationErrors.has(detail?.reason))?.reason : undefined
  if (reason) return new HTTPException(503, { message: `${configurationErrors.get(reason)} Puedes usar el alta manual.` })
  if (response.status === 429) return new HTTPException(429, { message: 'Google Places alcanzó su límite de consultas. Intenta más tarde o usa el alta manual.' })
  return new HTTPException(502, { message: unavailable })
}

const placesKey = () => {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
  if (!key) throw new HTTPException(503, { message: 'Google Places no está configurado.' })
  return key
}
const asPlace = (data) => ({
  id: data.id, name: data.displayName?.text, address: data.formattedAddress, attributions: data.attributions ?? [],
})

export async function getPlacesReference(id) {
  const key = placesKey()
  const result = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId.parse(id))}`, {
    signal: AbortSignal.timeout(7000),
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,attributions' },
  }).catch(() => null)
  if (!result?.ok) throw await placesFailure(result)
  return asPlace(await result.json())
}

export function placesRoutes(app) {
  app.post('/api/places/search', requireUser, requireVerified, async (c) => {
    const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
    if (!key) throw new HTTPException(503, { message: 'Google Places no está configurado. Puedes hacer una solicitud manual.' })
    const { q } = await json(c, z.object({ q: text(3, 120) }))
    const user = c.get('user')
    await ensureProfile(user)
    const { rowCount } = await query(`INSERT INTO places_rate_limits (user_id, window_start)
      VALUES ($1, date_trunc('hour', now())) ON CONFLICT (user_id, window_start)
      DO UPDATE SET attempts = places_rate_limits.attempts + 1 WHERE places_rate_limits.attempts < 12
      RETURNING attempts`, [user.id])
    if (!rowCount) throw new HTTPException(429, { message: 'Alcanzaste el límite de búsquedas por hora. Usa el alta manual.' })

    const result = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.attributions',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'es', pageSize: 6, includedType: 'restaurant' }),
    }).catch(() => null)
    if (!result?.ok) throw await placesFailure(result)
    const { places = [] } = await result.json()
    const ids = places.map(({ id }) => id).filter((id) => placeId.safeParse(id).success)
    const { rows } = await query("SELECT place_id, slug FROM branches WHERE status = 'active' AND place_id = ANY($1::text[])", [ids])
    const existing = new Map(rows.map(({ place_id, slug }) => [place_id, slug]))
    c.header('Cache-Control', 'no-store')
    return c.json(places.filter(({ id }) => ids.includes(id)).map((p) => ({ ...asPlace(p), existingSlug: existing.get(p.id) })))
  })
}
