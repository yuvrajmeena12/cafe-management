import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass, Home, UtensilsCrossed } from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'

export default function NotFound() {
  return (
    <AnimatedPage>
      <div className="min-h-[70vh] flex items-center justify-center bg-cream-50 px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-sage-200/80 shadow-card text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-saffron-50 border border-saffron-200 flex items-center justify-center text-saffron-600 shadow-sm">
            <Compass size={32} />
          </div>

          <p className="text-xs uppercase tracking-widest font-semibold text-saffron-600 mb-2">
            404 Error
          </p>

          <h1 className="font-serif text-3xl font-bold text-sage-900 mb-3">
            Page Not Found
          </h1>

          <p className="text-sm text-sage-600 mb-8 leading-relaxed">
            We couldn&apos;t find the page you were looking for. It may have been moved or doesn&apos;t exist.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/"
              className="flex-1 btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Home size={15} />
              Back to Home
            </Link>
            <Link
              to="/menu"
              className="flex-1 btn-secondary py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <UtensilsCrossed size={15} />
              Browse Menu
            </Link>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
