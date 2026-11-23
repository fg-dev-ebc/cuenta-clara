import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'

export const uuid = z.uuid()
export const text = (min, max) => z.string().trim().min(min).max(max)
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150)
export const day = z.iso.date()
export const optionalText = (max) => text(1, max).optional()
export const formKind = z.enum(['general', 'price', 'buffet', 'tip', 'parking', 'charge'])
export const regionCode = z.string().regex(/^[A-Z]{2}$/)
export const placeId = z.string().regex(/^[a-zA-Z0-9_-]{1,255}$/)
export const amount = z.number().min(0).max(9_999_999_999.99)
export const branchData = z.object({
  name: text(2, 120),
  branchName: text(1, 100),
  zone: text(1, 100),
  address: text(3, 250),
  establishmentId: uuid.optional(),
  placeId: placeId.optional(),
})

const timing = z.enum(['Antes', 'Durante', 'Al recibir la cuenta', 'No se informó'])
const concept = optionalText(120)
const conditions = optionalText(450)
const detailSchemas = {
  general: z.strictObject({}),
  price: z.strictObject({ advertisedPrice: amount.optional(), conditions }),
  buffet: z.strictObject({ advertisedPrice: amount.optional(), conditions }),
  charge: z.strictObject({ concept, timing: timing.optional(), conditions }),
  tip: z.strictObject({ percentage: z.number().min(0).max(100).optional(), timing: timing.optional() }),
  parking: z.strictObject({
    availability: z.enum(['Disponible', 'No disponible', 'No confirmado']).optional(),
    parkingType: z.enum(['Del restaurante', 'De la plaza', 'En la vía pública', 'Otro']).optional(),
    conditions,
  }),
}

export function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function parseDetails(kind, data) {
  return detailSchemas[kind].parse(data)
}

export const reviewInput = z.object({
  categoryId: uuid,
  title: text(4, 100),
  description: text(15, 3000),
  visitedOn: day.refine((value) => value <= new Date().toISOString().slice(0, 10), 'La visita no puede ser futura'),
  amount: amount.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  details: z.record(z.string(), z.unknown()).default({}),
  uploads: z.array(uuid).max(3).default([]).refine((values) => new Set(values).size === values.length),
}).refine((data) => (
  (data.amount === undefined && data.details.advertisedPrice === undefined)
  || data.currency !== undefined
), 'Indica la moneda del importe')

export function pagination(value, size = 12) {
  const page = z.coerce.number().int().min(1).max(10_000).parse(value ?? '1')
  return { page, limit: size, offset: (page - 1) * size }
}

export function paginated(rows, { page, limit, offset }) {
  return { items: rows.slice(0, limit), page, hasNext: rows.length > limit, offset }
}

export const notFound = (message = 'No encontramos ese registro.') => new HTTPException(404, { message })
export const conflict = (message) => new HTTPException(409, { message })

export async function json(c, schema) {
  if (!c.req.header('content-type')?.startsWith('application/json')) {
    throw new HTTPException(415, { message: 'Envía el formulario en formato JSON.' })
  }
  let data
  try {
    data = await c.req.json()
  } catch {
    throw new HTTPException(400, { message: 'El formulario no es válido.' })
  }
  return schema.parse(data)
}
