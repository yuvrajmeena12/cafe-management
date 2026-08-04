import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Chatbot from './components/Chatbot'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Menu from './pages/Menu'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import TrackOrder from './pages/TrackOrder'
import Reviews from './pages/Reviews'
import About from './pages/About'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Invoice from './pages/Invoice'
import DeliveryDashboard from './pages/delivery/DeliveryDashboard'

import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import MenuItems from './pages/admin/MenuItems'
import OrdersKitchen from './pages/admin/OrdersKitchen'
import Inventory from './pages/admin/Inventory'
import Staff from './pages/admin/Staff'
import Discounts from './pages/admin/Discounts'
import DeliveryCharges from './pages/admin/DeliveryCharges'
import Expenses from './pages/admin/Expenses'
import ProfitCalculator from './pages/admin/ProfitCalculator'
import AdminReviews from './pages/admin/AdminReviews'
import Settings from './pages/admin/Settings'
import Gallery from './pages/admin/Gallery'
import UserRoles from './pages/admin/UserRoles'

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

export default function App() {
  return (
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
      <Route path="/invoice/:orderId" element={<PublicLayout><Invoice /></PublicLayout>} />

      {/* Delivery staff dashboard — separate from admin, no site chrome */}
      <Route
        path="/delivery"
        element={
          <ProtectedRoute allowedRoles={['delivery']}>
            <DeliveryDashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin panel — protected, role = admin only */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="menu" element={<MenuItems />} />
        <Route path="orders" element={<OrdersKitchen />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="staff" element={<Staff />} />
        <Route path="discounts" element={<Discounts />} />
        <Route path="delivery-charges" element={<DeliveryCharges />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="profit-calculator" element={<ProfitCalculator />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="user-roles" element={<UserRoles />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
