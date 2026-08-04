import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, LayoutGrid, ChevronDown, Package, LogOut } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useCafeSettings } from '../context/CafeSettingsContext'

export default function Navbar() {
  const { itemCount } = useCart()
  const { profile, isAdmin, signOut } = useAuth()
  const { settings } = useCafeSettings()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-sage-100 print:hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-600 to-saffron-500 flex items-center justify-center text-white text-lg">☕</div>
          )}
          <div>
            <div className="font-display font-bold text-sage-700 text-lg leading-tight">{settings.cafe_name ?? 'Saffron & Sage'}</div>
            <div className="text-xs text-saffron-600">{settings.tagline ?? 'Eat Healthy, Stay Healthy'}</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-6 font-medium text-sage-700">
          <Link to="/" className="hover:text-saffron-600">Home</Link>
          <Link to="/menu" className="hover:text-saffron-600">Menu</Link>
          <Link to="/track" className="hover:text-saffron-600">Track Order</Link>
          <Link to="/reviews" className="hover:text-saffron-600">Reviews</Link>
          <Link to="/about" className="hover:text-saffron-600">About</Link>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/cart')} className="relative p-2 rounded-lg bg-white border border-sage-100">
            <ShoppingCart size={20} className="text-sage-700" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-saffron-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>

          {isAdmin ? (
            <button onClick={() => navigate('/admin')} className="p-2 rounded-lg bg-sage-600 text-white">
              <LayoutGrid size={20} />
            </button>
          ) : profile?.role === 'delivery' ? (
            <button onClick={() => navigate('/delivery')} className="btn-secondary text-sm">🏍️ Delivery</button>
          ) : profile ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="btn-secondary text-sm flex items-center gap-1.5">
                {profile.full_name ?? 'Account'} <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-sage-100 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/track') }}
                    className="w-full text-left px-4 py-2.5 text-sm text-sage-700 hover:bg-sage-50 flex items-center gap-2"
                  >
                    <Package size={15} /> Track My Orders
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-sage-50"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate('/login')} className="btn-secondary text-sm">Login</button>
          )}
        </div>
      </div>
    </nav>
  )
}
