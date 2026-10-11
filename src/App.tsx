import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Chatbot from './components/Chatbot'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { isEnvValid, envConfigErrors } from './lib/env'

import Home from './pages/Home'
import Menu from './pages/Menu'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import TrackOrder from './pages/TrackOrder'
import Reviews from './pages/Reviews'
import About from './pages/About'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import NotFound from './pages/NotFound'

// Lazy-loaded secondary and admin routes (code-split)
const Invoice = lazy(() => import('./pages/Invoice'))
const DeliveryDashboard = lazy(() => import('./pages/delivery/DeliveryDashboard'))

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const MenuItems = lazy(() => import('./pages/admin/MenuItems'))
const OrdersKitchen = lazy(() => import('./pages/admin/OrdersKitchen'))
const Inventory = lazy(() => import('./pages/admin/Inventory'))
const Staff = lazy(() => import('./pages/admin/Staff'))
const Discounts = lazy(() => import('./pages/admin/Discounts'))
const DeliveryCharges = lazy(() => import('./pages/admin/DeliveryCharges'))
const Expenses = lazy(() => import('./pages/admin/Expenses'))
const ProfitCalculator = lazy(() => import('./pages/admin/ProfitCalculator'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Gallery = lazy(() => import('./pages/admin/Gallery'))
const UserRoles = lazy(() => import('./pages/admin/UserRoles'))

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <Chatbot />
    </div>
  )
}

function PageFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <div className="w-8 h-8 border-2 border-sage-200 border-t-saffron-500 rounded-full animate-spin" />
      <span className="text-xs text-sage-400 font-medium">Loading…</span>
    </div>
  )
}

export default function App() {
  if (!isEnvValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200/80 shadow-card text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle size={28} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-sage-900 mb-2">Configuration Required</h1>
          <p className="text-sm text-sage-600 mb-6 leading-relaxed">
            The application requires valid Supabase environment variables to initialize backend services.
          </p>
          <div className="text-left p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 space-y-1">
            {envConfigErrors.map((err, i) => (
              <p key={i} className="font-mono">• {err}</p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        {/* Customer-facing site */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/menu" element={<PublicLayout><Menu /></PublicLayout>} />
        <Route path="/cart" element={<PublicLayout><Cart /></PublicLayout>} />
        <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
        <Route path="/track" element={<PublicLayout><TrackOrder /></PublicLayout>} />
        <Route path="/reviews" element={<PublicLayout><Reviews /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
        <Route
          path="/invoice/:orderId"
          element={
            <PublicLayout>
              <Suspense fallback={<PageFallback />}>
                <Invoice />
              </Suspense>
            </PublicLayout>
          }
        />

        {/* Delivery staff dashboard — separate from admin, no site chrome */}
        <Route
          path="/delivery"
          element={
            <ProtectedRoute allowedRoles={['delivery', 'admin']}>
              <Suspense fallback={<PageFallback />}>
                <DeliveryDashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Admin panel — protected, role = admin only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <Suspense fallback={<PageFallback />}>
                <AdminLayout />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="menu" element={<Suspense fallback={<PageFallback />}><MenuItems /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<PageFallback />}><OrdersKitchen /></Suspense>} />
          <Route path="inventory" element={<Suspense fallback={<PageFallback />}><Inventory /></Suspense>} />
          <Route path="staff" element={<Suspense fallback={<PageFallback />}><Staff /></Suspense>} />
          <Route path="discounts" element={<Suspense fallback={<PageFallback />}><Discounts /></Suspense>} />
          <Route path="delivery-charges" element={<Suspense fallback={<PageFallback />}><DeliveryCharges /></Suspense>} />
          <Route path="expenses" element={<Suspense fallback={<PageFallback />}><Expenses /></Suspense>} />
          <Route path="profit-calculator" element={<Suspense fallback={<PageFallback />}><ProfitCalculator /></Suspense>} />
          <Route path="reviews" element={<Suspense fallback={<PageFallback />}><AdminReviews /></Suspense>} />
          <Route path="gallery" element={<Suspense fallback={<PageFallback />}><Gallery /></Suspense>} />
          <Route path="user-roles" element={<Suspense fallback={<PageFallback />}><UserRoles /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
        </Route>

        {/* Catch-all 404 route */}
        <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
      </Routes>
    </ErrorBoundary>
  )
}
