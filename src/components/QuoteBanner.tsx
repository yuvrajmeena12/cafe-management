import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const QUOTES = [
  'Eat healthy, stay healthy.',
  'A healthy outside starts from the inside.',
  'Let food be thy medicine and medicine be thy food.',
  'Take care of your body. It is the only place you have to live.',
]

export default function QuoteBanner() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-saffron-500 text-white py-4 px-6 flex items-center justify-center text-center" style={{ minHeight: 56 }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="font-medium text-base sm:text-lg"
        >
          {QUOTES[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
