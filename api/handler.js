import { app } from '../server/app.js'

const forwardedPath = '__cc_api_path'

export default {
  fetch(request) {
    const url = new URL(request.url)
    const path = url.searchParams.get(forwardedPath)
    if (url.pathname === '/api/handler') {
      // Some adapters pass the rewrite's destination instead of the original pathname.
      if (!path || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(path)) {
        return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 })
      }
      url.pathname = `/api/${path}`
    } else if (!url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 })
    }
    if (url.searchParams.has(forwardedPath)) url.searchParams.delete(forwardedPath)
    return app.fetch(url.href === request.url ? request : new Request(url, request))
  },
}
