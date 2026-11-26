import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles.css'
import { Services } from './client.jsx'
import { AuthPage, MyContributions, PrivatePage, ProfilePage } from './account.jsx'
import { AdminBranches, AdminCategories, AdminLayout, AdminModeration, AdminRequest, AdminRequests, Dashboard } from './admin.jsx'
import { BranchPage, DirectoryPage } from './directory.jsx'
import { PitchPage } from './pitch.jsx'
import { PublishPage, RequestPage } from './publish.jsx'
import { Empty, Footer, Header, PageHeading } from './ui.jsx'
import './site-theme.css'

function Legal({ privacy = false }) {
  return <article className="shell reading page-pad legal">
    <PageHeading label="CUENTA CLARA / INFORMACIÓN" title={privacy ? 'Privacidad' : 'Términos de uso'} />
    {privacy ? <>
      <p>Para crear una cuenta, Neon Auth procesa tu correo electrónico y tus credenciales. Si eliges entrar con Google, Google y Neon Auth procesan el acceso. Junto a tus reseñas públicas se muestran tu alias y, si la agregas, tu foto, no tu correo.</p>
      <p>Las reseñas publicadas y sus imágenes se muestran en el directorio. Las solicitudes pendientes o rechazadas y los motivos de moderación solo están disponibles para las personas autorizadas.</p>
      <p>Usamos un identificador de navegador para no contar recargas repetidas como visitas nuevas a una ficha. Si eliges buscar con Google Places, la consulta se envía a Google. Consulta la <a href="https://policies.google.com/privacy">Política de Privacidad de Google</a>.</p>
    </> : <>
      <p>Cuenta Clara organiza experiencias reportadas por la comunidad. No verifica las condiciones descritas ni garantiza que sigan vigentes. La ausencia de reseñas no confirma que no existan cargos o condiciones adicionales.</p>
      <p>Publica experiencias propias y utiliza fotografías que tengas derecho a compartir. No incluyas datos personales de otras personas. Puedes solicitar una corrección o reportar contenido para que el equipo lo revise.</p>
      <p>La búsqueda auxiliar usa servicios de Google Maps Platform. Su uso está sujeto a las <a href="https://www.google.com/help/terms_maps/">Condiciones del Servicio de Google Maps</a>.</p>
    </>}
  </article>
}

function App() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <>
    <Header />
    <main id="contenido" tabIndex={-1}><Routes>
      <Route path="/" element={<DirectoryPage home />} />
      <Route path="/establecimientos" element={<DirectoryPage />} />
      <Route path="/establecimientos/:slug" element={<BranchPage />} />
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route path="/registro" element={<AuthPage key="registro" register />} />
      <Route path="/publicar" element={<PrivatePage><PublishPage /></PrivatePage>} />
      <Route path="/solicitar-establecimiento" element={<PrivatePage><RequestPage /></PrivatePage>} />
      <Route path="/mis-aportaciones" element={<PrivatePage><MyContributions /></PrivatePage>} />
      <Route path="/perfil" element={<PrivatePage><ProfilePage /></PrivatePage>} />
      <Route path="/admin" element={<PrivatePage admin><AdminLayout /></PrivatePage>}>
        <Route index element={<Navigate replace to="dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="establecimientos" element={<AdminBranches />} />
        <Route path="solicitudes" element={<AdminRequests />} />
        <Route path="solicitudes/:id" element={<AdminRequest />} />
        <Route path="reportes" element={<AdminModeration key="reportes" />} />
        <Route path="correcciones" element={<AdminModeration key="correcciones" corrections />} />
        <Route path="categorias" element={<AdminCategories />} />
      </Route>
      <Route path="/terminos" element={<Legal />} />
      <Route path="/privacidad" element={<Legal privacy />} />
      <Route path="/pitch-hackaton" element={<PitchPage />} />
      <Route path="*" element={<div className="shell page-pad"><Empty title="Página no encontrada"><Link className="inline-link" to="/">Volver al inicio →</Link></Empty></div>} />
    </Routes></main>
    <Footer />
  </>
}

createRoot(document.getElementById('root')).render(
  <StrictMode><BrowserRouter><Services><App /></Services></BrowserRouter></StrictMode>,
)
