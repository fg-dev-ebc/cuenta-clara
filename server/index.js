import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.js'

app.all('/api/*', (c) => c.json({ error: 'Ruta no encontrada.' }, 404))

if (existsSync('dist/index.html')) {
  app.use('/assets/*', serveStatic({ root: './dist' }))
  app.get('/favicon.svg', serveStatic({ path: './dist/favicon.svg' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

serve({ fetch: app.fetch, port: Number(process.env.PORT || 3001) }, ({ port }) => {
  console.log(`Cuenta Clara API · http://localhost:${port}`)
})
