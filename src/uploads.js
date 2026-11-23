export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const mediaTypes = ['image/jpeg', 'image/png', 'image/webp']

export function validImage(file) {
  return mediaTypes.includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
}

export async function uploadImage(request, file) {
  const upload = await request('/uploads', { body: { type: file.type, size: file.size } })
  const data = new FormData()
  for (const [name, value] of Object.entries(upload.fields)) data.set(name, value)
  data.set('file', file)
  const response = await fetch(upload.url, { method: 'POST', body: data })
  if (!response.ok) throw new Error('No pudimos subir una imagen. Vuelve a intentarlo.')
  return upload.id
}
