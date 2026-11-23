# Cuenta Clara

Directorio colaborativo de experiencias sobre restaurantes, organizado por sucursal. No hay estrellas ni calificaciones: cada aportación describe condiciones concretas, con categoría y fecha de visita. El directorio empieza vacío; las categorías son los únicos datos precargados.

## Desarrollo

Node.js 22.12 o superior, npm y el proyecto de desarrollo en Neon:

```powershell
npm ci
npx --yes neon@latest login
npx --yes neon@latest link --project-id lucky-sky-76116272 --branch development --no-env-pull --no-config -y
npx --yes neon@latest env pull --service postgres --service auth --service object-storage --service realtime --file .env.local
```

En `.env.local`, configura `NEON_AUTH_COOKIE_SECRET` con un secreto aleatorio de al menos 32 caracteres. No publiques este archivo. Para crearlo en PowerShell si todavía no existe:

```powershell
if (-not (Select-String -Path .env.local -Pattern '^NEON_AUTH_COOKIE_SECRET=' -Quiet)) {
    $cookieSecret = node -p "require('node:crypto').randomBytes(36).toString('base64url')"
    Add-Content -Path .env.local -Value "NEON_AUTH_COOKIE_SECRET=$cookieSecret"
    Remove-Variable cookieSecret
}
```

```powershell
npm run db:migrate
npm run storage:cors
npm run dev
```

La web abre en `http://localhost:5173` y la API en el puerto `3001`. Para servir la compilación y API juntas, ejecuta `npm run build` y `npm start`. En producción usa HTTPS, establece `APP_ORIGIN` en el origen público de la web y regístralo en Neon Auth, Realtime y CORS de Object Storage. En Auth, usa SMTP propio para entregar códigos de verificación.

## Despliegue en Vercel

Despliega la raíz del repositorio, no solo `dist/`: `vercel.json` sirve la web de Vite y enruta `/api/*` a `api/handler.js`, que reutiliza la API Hono. Las rutas de React como `/login` y `/perfil` también se pueden abrir directamente.

En el proyecto de Vercel, configura `APP_ORIGIN=https://cuenta-clara-hackathon.vercel.app` para producción y las variables del backend que corresponden a la rama Neon desplegada: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEON_REALTIME_URL`, `NEON_REALTIME_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` y `AWS_REGION`. Agrega `GOOGLE_PLACES_API_KEY` para habilitar esa búsqueda auxiliar. No uses el prefijo `VITE_` para estas variables. Las migraciones usan la conexión directa por separado; la API desplegada usa la conexión con pool.

Una vez que controles el dominio, autoriza `https://cuenta-clara-hackathon.vercel.app` en Neon Auth y en los orígenes de Realtime para esa rama. En Object Storage, añade CORS de subida para el mismo origen: `npm run storage:cors -- https://cuenta-clara-hackathon.vercel.app` con las credenciales de la rama correspondiente. Después de desplegar, comprueba que `/api/config` y `/api/categories` devuelven JSON y que `/login` abre la aplicación.

### Google Places

Habilita **Places API (New)** y facturación en Google Cloud. Guarda la clave restringida en `.env.local` como `GOOGLE_PLACES_API_KEY`, sin prefijo `VITE_`. Si no hay clave, el alta manual y la búsqueda del directorio siguen funcionando. El flujo auxiliar no copia automáticamente resultados de Google a Postgres; solo guarda el identificador del lugar y los datos aportados por una fuente autorizada.

Si eliges un resultado de Places, solo envías esa selección y tu reseña. El equipo completa los datos de la sucursal en administración antes de publicar. Puede consultar la referencia de Google de forma temporal en el detalle de la solicitud.

### Acceso con Google y perfil

La opción **Continuar con Google** usa el proveedor compartido de Neon Auth en desarrollo. Es independiente de Google Places. Para producción, configura un cliente OAuth web propio en Google Cloud con el URI de retorno `{NEON_AUTH_BASE_URL}/callback/google` y agrega sus credenciales a la rama correspondiente de Neon Auth.

En **Mi perfil** (`/perfil`), cada usuario puede cambiar su alias y su foto. El correo de acceso es privado y lo administra Neon Auth.

### Administración

Registra y verifica la cuenta que administrará Cuenta Clara. Inicia sesión una vez para crear su perfil local. Copia el UUID de la cuenta desde la consola de Neon Auth y ejecuta `npm run db:admin -- <UUID>`. No hay un registro público de administradores.

Las reseñas de una sucursal activa aparecen inmediatamente. Al aprobar o vincular una solicitud de alta, la reseña asociada se publica dentro de la misma transacción. Los reportes y correcciones se moderan después de publicar. Las fotos se procesan a WebP y se consultan mediante URLs temporales desde un bucket privado.

### Pruebas

`npm test` ejecuta las pruebas unitarias. La prueba de integración contra Neon usa credenciales de una rama descartable con prefijo `verify-`, para no llenar el directorio de desarrollo con datos de prueba:

```powershell
npx --yes neon@latest env pull --branch verify-cuenta-clara --service postgres --service object-storage --file .env.integration
node --env-file=.env.integration --test
```

La rama de pruebas debe heredar una migración aplicada y el bucket `review-images`. Las pruebas simulan la respuesta de sesión de Neon Auth para probar autorización sin enviar correos ni crear usuarios reales.
