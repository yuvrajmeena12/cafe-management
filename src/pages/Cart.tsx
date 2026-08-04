import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '../context/CartContext'

export default function Cart() {
  const { lines, updateQuantity, removeItem, subtotal } = useCart()
  const navigate = useNavigate()

  if (lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-sage-400 mb-4">Your cart is empty.</p>
        <Link to="/menu" className="btn-primary">Browse Menu</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-6">Your Cart</h1>
      <div className="space-y-4">
        {lines.map((line) => (
          <div key={line.menu_item.id} className="card p-4 flex items-center gap-4">
            <img src={line.menu_item.image_url} className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1">
              <div className="font-semibold text-sage-700">{line.menu_item.name}</div>
              <div className="text-saffron-600 font-bold">₹{line.menu_item.price.toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQuantity(line.menu_item.id, line.quantity - 1)} className="p-1.5 bg-sage-50 rounded-md"><Minus size={14} /></button>
              <span className="w-6 text-center">{line.quantity}</span>
              <button onClick={() => updateQuantity(line.menu_item.id, line.quantity + 1)} className="p-1.5 bg-sage-50 rounded-md"><Plus size={14} /></button>
            </div>
            <button onClick={() => removeItem(line.menu_item.id)} className="p-2 text-red-500"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      <div className="card p-5 mt-6 flex justify-between items-center">
        <span className="text-sage-600">Subtotal</span>
        <span className="font-display text-2xl font-bold text-sage-700">₹{subtotal.toFixed(2)}</span>
      </div>
      <button onClick={() => navigate('/checkout')} className="btn-primary w-full mt-4">Proceed to Checkout</button>
    </div>
  )
}
