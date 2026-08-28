import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, UtensilsCrossed, ChefHat, Package, Users, Tag, Receipt, Star, Settings, LogOut, Sparkles, Truck, Images, UserCog,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useCafeSettings } from '../../context/CafeSettingsContext'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/admin/menu', label: 'Menu Items', icon: UtensilsCrossed },
  { to: '/admin/orders', label: 'Orders & Kitchen', icon: ChefHat },
  { to: '/admin/inventory', label: 'Inventory', icon: Package },
  { to: '/admin/staff', label: 'Staff & Attendance', icon: Users },
  { to: '/admin/discounts', label: 'Discounts & Blasts', icon: Tag },
  { to: '/admin/delivery-charges', label: 'Delivery Charges', icon: Truck },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/profit-calculator', label: 'Profit Calculator', icon: Sparkles },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/user-roles', label: 'User Roles', icon: UserCog },
  { to: '/admin/settings', label: 'Cafe Settings', icon: Settings },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const { settings } = useCafeSettings()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-72 bg-white border-r border-sage-100 p-6 flex flex-col shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sage-700 to-saffron-500 flex items-center justify-center text-white overflow-hidden shadow-sm">
            {settings.logo_url ? <img src={settings.logo_url} className="w-full h-full object-cover" /> : '☕'}
          </div>
          <div>
            <div className="font-display font-bold text-sage-800 text-base">{settings.cafe_name ?? 'Saffron & Sage'}</div>
            <div className="text-[11px] font-semibold text-saffron-600 uppercase tracking-wider">Admin Control Center</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? pathname === to : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                  active
                    ? 'bg-saffron-500 text-white shadow-md shadow-saffron-500/20'
                    : 'text-sage-600 hover:bg-sage-50 hover:text-sage-900'
                }`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <button
          onClick={async () => { await signOut(); navigate('/') }}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-500 hover:bg-red-50 font-semibold text-xs mt-4 transition-colors"
        >
          <LogOut size={16} /> Exit Admin Panel
        </button>
      </aside>

      <main className="flex-1 p-8 sm:p-10 overflow-y-auto">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
