import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Plus, Check, Star } from 'lucide-react'
import type { MenuItem } from '../types'
import { useCart } from '../context/CartContext'

interface Props {
  item: MenuItem
  avgRating?: number | null
  ratingCount?: number
}

export default function ProductCard({ item, avgRating, ratingCount }: Props) {
  const { addItem } = useCart()
  const [justAdded, setJustAdded] = useState(false)

  function handleAdd() {
    addItem(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1400)
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="card overflow-hidden flex flex-col relative"
    >
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute top-3 right-3 z-10 bg-sage-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg"
          >
            <Check size={13} /> Added to cart!
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative h-44 overflow-hidden">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        {item.is_popular && (
          <span className="absolute top-2 left-2 bg-saffron-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            ★ Popular
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start">
          <h3 className="font-display font-bold text-sage-700">{item.name}</h3>
          <span className="text-saffron-600 font-bold">₹{item.price.toFixed(2)}</span>
        </div>
        {avgRating != null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-sage-500">
            <Star size={13} className="fill-saffron-500 text-saffron-500" />
            <span className="font-medium text-sage-700">{avgRating.toFixed(1)}</span>
            {ratingCount != null && <span>({ratingCount})</span>}
          </div>
        )}
        <p className="text-sm text-sage-600 mt-1 flex-1">{item.description}</p>
        <div className="flex gap-2 flex-wrap mt-3 text-xs">
          {item.calories != null && (
            <span className="flex items-center gap-1 bg-sage-50 px-2 py-1 rounded-full text-sage-600">
              <Flame size={12} /> {item.calories} cal
            </span>
          )}
          {item.tags.map((tag) => (
            <span key={tag} className="bg-sage-50 px-2 py-1 rounded-full text-sage-600">{tag}</span>
          ))}
        </div>
        <motion.button
          onClick={handleAdd}
          whileTap={{ scale: 0.96 }}
          className="btn-primary mt-4 flex items-center justify-center gap-2 text-sm"
        >
          {justAdded ? <Check size={16} /> : <Plus size={16} />} {justAdded ? 'Added!' : 'Add to Cart'}
        </motion.button>
      </div>
    </motion.div>
  )
}
