import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const QUOTES = [
  'Take care of your body. It is the only place you have to live.',
  'A healthy outside starts from the inside.',
  'The food you eat can be either the safest medicine or the slowest poison.',
  'Let food be thy medicine and medicine be thy food.',
  'Eat healthy, stay healthy.',
]

export default function HeroQuoteOverlay() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setIndex((prev) => (prev + 1) % QUOTES.length), 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute bottom-6 right-6 z-10 max-w-xs hidden sm:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="bg-white/85 backdrop-blur-sm rounded-2xl p-4 shadow-lg"
        >
          <Sparkles size={18} className="text-saffron-500 mb-1.5" />
          <p className="italic text-sage-700 font-display text-sm leading-snug">"{QUOTES[index]}"</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
