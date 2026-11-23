import { GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { storage } from './storage.js'

try {
  const origin = new URL(process.argv[2] ?? 'http://localhost:5173').origin
  if (!/^https?:\/\//.test(origin)) throw new Error('Indica un origen HTTP o HTTPS')
  const Bucket = process.env.NEON_STORAGE_BUCKET || 'review-images'
  const client = storage()
  let rules = []
  try {
    rules = (await client.send(new GetBucketCorsCommand({ Bucket }))).CORSRules ?? []
  } catch (error) {
    if (error.name !== 'NoSuchCORSConfiguration' && error.$metadata?.httpStatusCode !== 404) throw error
  }
  if (!rules.some((rule) => rule.AllowedOrigins.includes(origin) && rule.AllowedMethods.includes('POST'))) {
    await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: [...rules, {
      AllowedOrigins: [origin], AllowedMethods: ['POST'], AllowedHeaders: ['Content-Type'], MaxAgeSeconds: 300,
    }] } }))
  }
  console.log(`CORS de subida configurado para ${origin}`)
} catch (error) {
  console.error('No se pudo configurar CORS:', error.name)
  process.exitCode = 1
}
