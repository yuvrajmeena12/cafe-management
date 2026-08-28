import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, LayoutGrid, ChevronDown, Package, LogOut, Menu as MenuIcon, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useCafeSettings } from '../context/CafeSettingsContext'

export default function Navbar() {
  const { itemCount } = useCart()
  const { profile, isAdmin, signOut } = useAuth()
  const { settings } = useCafeSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const links = [
    { to: '/', label: 'Home' },
    { to: '/menu', label: 'Menu' },
    { to: '/track', label: 'Track Order' },
    { to: '/reviews', label: 'Reviews' },
    { to: '/about', label: 'About' },
  ]

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 print:hidden ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-sage-100/80 py-2.5'
          : 'bg-cream/80 backdrop-blur-sm border-b border-sage-100/50 py-3.5'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-700 to-saffron-500 flex items-center justify-center text-white text-lg shadow-sm">
                ☕
              </div>
            )}
          </motion.div>
          <div>
            <div className="font-display font-bold text-sage-800 text-lg leading-tight group-hover:text-saffron-600 transition-colors">
              {settings.cafe_name ?? 'Saffron & Sage'}
            </div>
            <div className="text-xs text-saffron-600 font-medium">{settings.tagline ?? 'Eat Healthy, Stay Healthy'}</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-7 font-semibold text-sm text-sage-700">
          {links.map((link) => {
            const active = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative py-1 transition-colors hover:text-saffron-600 ${
                  active ? 'text-saffron-600' : 'text-sage-700'
                }`}
              >
                {link.label}
                {active && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-saffron-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/cart')}
            className="relative p-2.5 rounded-xl bg-white border border-sage-200/80 shadow-sm hover:border-saffron-300 transition-colors"
            aria-label="Shopping Cart"
          >
            <ShoppingCart size={19} className="text-sage-700" />
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span
                  key="cartBadge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1.5 -right-1.5 bg-saffron-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse-glow"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {isAdmin ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className="p-2.5 rounded-xl bg-sage-800 hover:bg-sage-900 text-white shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <LayoutGrid size={16} /> Admin
            </motion.button>
          ) : profile?.role === 'delivery' ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/delivery')}
              className="btn-secondary text-xs py-2 flex items-center gap-1"
            >
              🏍️ Portal
            </motion.button>
          ) : profile ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="btn-secondary text-xs py-2 flex items-center gap-1.5"
              >
                <span className="font-semibold truncate max-w-[100px]">{profile.full_name || 'Account'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-white/95 backdrop-blur-md border border-sage-100 rounded-2xl shadow-xl overflow-hidden py-1.5 z-50"
                  >
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/track') }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-sage-700 hover:bg-sage-50 flex items-center gap-2.5"
                    >
                      <Package size={15} className="text-saffron-500" /> My Orders & History
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 flex items-center gap-2.5 border-t border-sage-50"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
              className="btn-secondary text-xs py-2 font-semibold"
            >
              Log In
            </motion.button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 rounded-xl text-sage-700 hover:bg-sage-100 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-sage-100 px-6 py-4 space-y-3"
          >
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block py-2 text-sm font-semibold text-sage-700 hover:text-saffron-600"
              >
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
