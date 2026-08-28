import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'
import AnimatedPage from '../components/AnimatedPage'
import AnimatedCounter from '../components/AnimatedCounter'

export default function Cart() {
  const { lines, updateQuantity, removeItem, subtotal, itemCount } = useCart()
  const navigate = useNavigate()

  if (lines.length === 0) {
    return (
      <AnimatedPage className="max-w-2xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-saffron-50 rounded-3xl mx-auto flex items-center justify-center text-saffron-500 mb-6 shadow-sm animate-float"
        >
          <ShoppingBag size={36} />
        </motion.div>
        <h2 className="font-display text-3xl font-bold text-sage-800 mb-2">Your Feast Bag is Empty</h2>
        <p className="text-sage-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
          Looks like you haven't added anything yet. Explore our delicious bowls, artisan coffees, and fresh juices.
        </p>
        <Link to="/menu" className="btn-primary text-sm px-8 py-3.5 inline-flex items-center gap-2">
          Browse Fresh Menu <ArrowRight size={16} />
        </Link>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-sage-800">Your Cart</h1>
          <p className="text-sage-500 text-sm mt-0.5">{itemCount} items ready for preparation</p>
        </div>
        <Link to="/menu" className="text-xs font-bold text-saffron-600 hover:text-saffron-700">
          + Add more items
        </Link>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.menu_item.id}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="card p-4 sm:p-5 flex items-center gap-4 group"
            >
              <img
                src={line.menu_item.image_url}
                alt={line.menu_item.name}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-sage-100 group-hover:scale-105 transition-transform duration-300"
              />

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sage-800 text-base truncate">{line.menu_item.name}</h3>
                <div className="text-saffron-600 font-extrabold text-sm mt-0.5">
                  ₹{line.menu_item.price.toFixed(2)}
                </div>
                {line.menu_item.calories && (
                  <span className="text-[11px] text-sage-400 font-medium">
                    {line.menu_item.calories} cal
                  </span>
                )}
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 bg-sage-50/80 px-2 py-1 rounded-xl border border-sage-200/60">
                <button
                  onClick={() => updateQuantity(line.menu_item.id, line.quantity - 1)}
                  className="p-1 rounded-lg hover:bg-white text-sage-700 active:scale-90 transition-all"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-bold text-sm text-sage-800">{line.quantity}</span>
                <button
                  onClick={() => updateQuantity(line.menu_item.id, line.quantity + 1)}
                  className="p-1 rounded-lg hover:bg-white text-sage-700 active:scale-90 transition-all"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Line item total */}
              <div className="text-right font-bold text-sage-800 text-sm hidden sm:block w-20">
                ₹{(line.menu_item.price * line.quantity).toFixed(2)}
              </div>

              <button
                onClick={() => removeItem(line.menu_item.id)}
                className="p-2 text-sage-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                aria-label="Remove item"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Subtotal Summary Card */}
      <motion.div
        layout
        className="card p-6 mt-8 space-y-4 shadow-lg border-sage-200/80 bg-gradient-to-br from-white to-sage-50/40"
      >
        <div className="flex justify-between items-center text-sage-600 text-sm">
          <span>Items Subtotal</span>
          <span className="font-bold text-sage-800 text-base">
            <AnimatedCounter value={subtotal} prefix="₹" decimals={2} />
          </span>
        </div>

        <div className="flex justify-between items-center text-xs text-sage-500 pt-2 border-t border-sage-100">
          <span>Estimated Taxes & Delivery</span>
          <span>Calculated at checkout step</span>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-saffron-500/25"
        >
          Proceed to Secure Checkout <ArrowRight size={18} />
        </button>
      </motion.div>
    </AnimatedPage>
  )
}
