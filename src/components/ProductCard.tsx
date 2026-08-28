import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Plus, Check, Star, Sparkles } from 'lucide-react'
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
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="card overflow-hidden flex flex-col relative group border border-sage-100 hover:border-saffron-300/80 hover:shadow-xl transition-all duration-300"
    >
      {/* Just added banner */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute top-3 right-3 z-20 bg-sage-800 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-white/20"
          >
            <Check size={13} className="text-saffron-400" /> Added to cart!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image container */}
      <div className="relative h-48 overflow-hidden bg-sage-50">
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {item.is_popular && (
          <span className="absolute top-3 left-3 bg-gradient-to-r from-saffron-500 to-saffron-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
            <Sparkles size={11} /> Chef's Pick
          </span>
        )}

        {item.prep_time_minutes > 0 && (
          <span className="absolute bottom-2.5 left-3 bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-0.5 rounded-md">
            ⏱️ {item.prep_time_minutes} mins
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-display font-bold text-sage-800 text-lg group-hover:text-saffron-600 transition-colors leading-snug">
            {item.name}
          </h3>
          <span className="text-saffron-600 font-extrabold text-lg shrink-0">
            ₹{item.price.toFixed(2)}
          </span>
        </div>

        {avgRating != null && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-sage-500">
            <div className="flex items-center text-saffron-500">
              <Star size={13} className="fill-saffron-500" />
            </div>
            <span className="font-bold text-sage-800">{avgRating.toFixed(1)}</span>
            {ratingCount != null && <span>({ratingCount} reviews)</span>}
          </div>
        )}

        <p className="text-xs text-sage-600 mt-2 line-clamp-2 leading-relaxed flex-1">
          {item.description}
        </p>

        {/* Nutritional & dietary tags */}
        <div className="flex gap-1.5 flex-wrap mt-3.5 text-[11px]">
          {item.calories != null && (
            <span className="flex items-center gap-1 bg-sage-50 text-sage-700 font-medium px-2 py-0.5 rounded-md border border-sage-100">
              <Flame size={11} className="text-saffron-500" /> {item.calories} cal
            </span>
          )}
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="bg-cream text-sage-700 font-medium px-2 py-0.5 rounded-md border border-sage-200/60"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Add to Cart Button */}
        <motion.button
          onClick={handleAdd}
          whileTap={{ scale: 0.95 }}
          className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${
            justAdded
              ? 'bg-sage-800 text-white'
              : 'bg-gradient-to-r from-saffron-500 to-saffron-600 hover:from-saffron-600 hover:to-saffron-700 text-white shadow-saffron-500/20'
          }`}
        >
          {justAdded ? (
            <>
              <Check size={16} /> Added to Cart!
            </>
          ) : (
            <>
              <Plus size={16} /> Add to Cart
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}
