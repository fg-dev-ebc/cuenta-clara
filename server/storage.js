import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import sharp from 'sharp'
import { HTTPException } from 'hono/http-exception'
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ensureProfile, requireUser, requireVerified } from './auth.js'
import { query } from './db.js'
import { json, notFound, uuid } from './validation.js'

export const maxImageBytes = 5 * 1024 * 1024
const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }
const temporary = (id) => `incoming/${id}`
const bucket = () => process.env.NEON_STORAGE_BUCKET || 'review-images'
let client

export function storage() {
  if (!process.env.AWS_ENDPOINT_URL_S3 || !process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new HTTPException(503, { message: 'El almacenamiento de imágenes no está disponible.' })
  }
  client ??= new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3, region: process.env.AWS_REGION,
    forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

export async function discardImage(key) {
  try {
    await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
  } catch (error) {
    console.warn('No se pudo limpiar una imagen:', error.name)
  }
}

export async function prepareImages(user, ids, { avatar = false } = {}) {
  if (!ids.length) return []
  const { rowCount } = await query(`SELECT id FROM uploads WHERE id = ANY($1::uuid[]) AND author_id = $2
      AND consumed_at IS NULL AND created_at > now() - interval '1 hour'`, [ids, user.id])
  if (rowCount !== ids.length) throw new HTTPException(422, { message: 'Una de las imágenes ha caducado. Vuelve a adjuntarla.' })

  const images = []
  try {
    for (const id of ids) {
      const object = await storage().send(new GetObjectCommand({ Bucket: bucket(), Key: temporary(id) }))
      if (!object.Body || !object.ContentLength || object.ContentLength > maxImageBytes || !formats[object.ContentType]) {
        object.Body?.destroy?.()
        throw new Error('Formato o tamaño inválido')
      }
      const bytes = await object.Body.transformToByteArray()
      const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'warning' })
      const metadata = await image.metadata()
      if (metadata.format !== formats[object.ContentType] || (metadata.pages ?? 1) > 1) throw new Error('Formato inválido')
      const maxSide = avatar ? 512 : 1800
      const sanitized = await image.rotate().resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      const objectId = randomUUID()
      const key = `${avatar ? 'avatars' : 'reviews'}/${objectId}.webp`
      await storage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: sanitized, ContentType: 'image/webp' }))
      images.push({ id, key, objectId, bytes: sanitized.length })
    }
    return images
  } catch {
    await cleanImages(images)
    throw new HTTPException(422, { message: 'No se pudo procesar una imagen. Comprueba que sea JPG, PNG o WebP de hasta 5 MB.' })
  }
}

export async function consumeImages(db, user, images) {
  if (!images.length) return
  const { rowCount } = await db.query(`UPDATE uploads SET consumed_at = now() WHERE id = ANY($1::uuid[])
    AND author_id = $2 AND consumed_at IS NULL AND created_at > now() - interval '1 hour'`, [images.map((image) => image.id), user.id])
  if (rowCount !== images.length) throw new HTTPException(409, { message: 'Vuelve a adjuntar las imágenes antes de enviar.' })
}

export async function saveImages(db, review, user, images) {
  await consumeImages(db, user, images)
  for (const image of images) {
    await db.query(`INSERT INTO review_images (review_id, object_key, media_type, byte_size)
      VALUES ($1, $2, 'image/webp', $3)`, [review, image.key, image.bytes])
  }
}

export const cleanImages = (images, committed = false) =>
  Promise.all(images.map((image) => discardImage(committed ? temporary(image.id) : image.key)))

async function serveImage(c, key, privileged = false) {
  const url = await getSignedUrl(storage(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 60 })
  c.header('Cache-Control', 'no-store')
  return privileged ? c.json({ url }) : c.redirect(url)
}

async function imageRedirect(c, privileged) {
  const id = uuid.parse(c.req.param('id'))
  const { rows: [image] } = await query(`
    SELECT i.object_key FROM review_images i JOIN reviews r ON r.id = i.review_id
    LEFT JOIN branches b ON b.id = r.branch_id WHERE i.id = $1
      ${privileged ? '' : "AND r.status = 'published' AND b.status = 'active'"}`, [id])
  if (!image) throw notFound()
  return serveImage(c, image.object_key, privileged)
}

export const administrativeImage = (c) => imageRedirect(c, true)

export function storageRoutes(app) {
  app.get('/api/images/:id', (c) => imageRedirect(c, false))
  app.get('/api/avatars/:id', async (c) => {
    const { rows: [profile] } = await query('SELECT avatar_key FROM profiles WHERE avatar_id = $1', [uuid.parse(c.req.param('id'))])
    if (!profile) throw notFound()
    return serveImage(c, profile.avatar_key)
  })
  app.post('/api/uploads', requireUser, requireVerified, async (c) => {
    const { type, size } = await json(c, z.object({
      type: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().int().min(1).max(maxImageBytes),
    }))
    const user = c.get('user')
    await ensureProfile(user)
    const { rows: [row] } = await query(`INSERT INTO uploads (author_id)
      SELECT $1 WHERE (SELECT count(*) FROM uploads WHERE author_id = $1 AND created_at > now() - interval '1 hour') < 30
      RETURNING id`, [user.id])
    if (!row) throw new HTTPException(429, { message: 'Has alcanzado el límite de imágenes por hora.' })
    const upload = await createPresignedPost(storage(), {
      Bucket: bucket(), Key: temporary(row.id), Expires: 180,
      Fields: { 'Content-Type': type },
      Conditions: [['eq', '$Content-Type', type], ['content-length-range', 1, Math.min(size + 2048, maxImageBytes + 2048)]],
    })
    return c.json({ id: row.id, ...upload }, 201)
  })
}
