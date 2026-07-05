import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import DashboardLayout from './components/DashboardLayout.jsx'
import Home from './pages/Home.jsx'
import Auth from './pages/Auth.jsx'
import NotFound from './pages/NotFound.jsx'
import { useLang } from './context/LanguageContext.jsx'
import FullscreenLoader from './components/FullscreenLoader.jsx'

// Public marketing pages (light).
const About = lazy(() => import('./pages/About.jsx'))
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'))
const Pricing = lazy(() => import('./pages/Pricing.jsx'))
const PublicShare = lazy(() => import('./pages/PublicShare.jsx'))
const CodeShare = lazy(() => import('./pages/CodeShare.jsx'))
const Legal = lazy(() => import('./pages/Legal.jsx'))

// Dashboard pages.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Store = lazy(() => import('./pages/Store.jsx'))        // Build Project (PRD)
const BuildCode = lazy(() => import('./pages/BuildCode.jsx')) // Build Code (bolt.new entry)
const Chat = lazy(() => import('./pages/Chat.jsx'))          // AI assistant chat
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx')) // Sandpack IDE
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname])
  return null
}

function RouteFallback() {
  return <FullscreenLoader />
}

function Page({ children }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.main>
  )
}

// Public site shell: marketing navbar + footer.
function PublicLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          {/* Public marketing site */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/tentang" element={<Page><About /></Page>} />
            <Route path="/cara-kerja" element={<Page><HowItWorks /></Page>} />
            <Route path="/harga" element={<Page><Pricing /></Page>} />
            <Route path="/ketentuan" element={<Page><Legal /></Page>} />
            <Route path="/privasi" element={<Page><Legal /></Page>} />
            <Route path="/share/:token" element={<Page><PublicShare /></Page>} />
          </Route>

          {/* Auth (standalone, full-screen) */}
          <Route path="/login" element={<Auth />} />
          <Route path="/share/code/:token" element={<Page><CodeShare /></Page>} />

          {/* Authenticated dashboard */}
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="build-project" element={<Store />} />
            <Route path="build-code" element={<BuildCode />} />
            <Route path="asisten" element={<Chat />} />
            <Route path="ide/:id" element={<ProductDetail />} />
            <Route path="admin" element={<Admin />} />
            <Route path="upgrade" element={<Pricing />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<PublicLayout />}>
            <Route path="*" element={<Page><NotFound /></Page>} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
