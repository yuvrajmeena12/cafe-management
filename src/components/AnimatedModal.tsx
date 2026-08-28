import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export default function AnimatedModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-sage-900/50 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`relative bg-white rounded-3xl p-6 sm:p-8 w-full ${maxWidth} shadow-2xl border border-sage-100/80 z-10 my-8 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-center mb-5">
              {title && <h2 className="font-display font-bold text-2xl text-sage-800">{title}</h2>}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-sage-100/80 text-sage-400 hover:text-sage-700 transition-colors ml-auto"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
