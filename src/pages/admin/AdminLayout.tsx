import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, UtensilsCrossed, ChefHat, Package, Users, Tag, Receipt, Star, Settings, LogOut, Sparkles, Truck, Images, UserCog,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCafeSettings } from '../../context/CafeSettingsContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/admin/menu', label: 'Menu Items', icon: UtensilsCrossed },
  { to: '/admin/orders', label: 'Orders & Kitchen', icon: ChefHat },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/discounts', label: 'Discounts', icon: Tag },
  { to: '/admin/delivery-charges', label: 'Delivery Charges', icon: Truck },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/profit-calculator', label: 'Profit Calculator', icon: Sparkles },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/user-roles', label: 'User Roles', icon: UserCog },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const { signOut, profile } = useAuth()
  const { settings } = useCafeSettings()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-72 bg-white border-r border-sage-100 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-600 to-saffron-500 flex items-center justify-center text-white overflow-hidden">
            {settings.logo_url ? <img src={settings.logo_url} className="w-full h-full object-cover" /> : '☕'}
          </div>
          <div>
            <div className="font-display font-bold text-sage-700">{settings.cafe_name ?? 'Saffron & Sage'}</div>
            <div className="text-xs text-saffron-600">Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? pathname === to : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  active ? 'bg-saffron-500 text-white' : 'text-sage-600 hover:bg-sage-50'
                }`}
              >
                <Icon size={18} /> {label}
              </Link>
            )
          })}
        </nav>
        <button
          onClick={async () => { await signOut(); navigate('/') }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-500 hover:bg-red-50 font-medium"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
