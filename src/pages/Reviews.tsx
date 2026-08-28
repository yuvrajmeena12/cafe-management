import { useEffect, useState } from 'react'
import { Star, PenLine, Send, CheckCircle2, MessageSquareHeart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AnimatedPage from '../components/AnimatedPage'
import AnimatedModal from '../components/AnimatedModal'
import type { Review, Order } from '../types'

const CATEGORIES = ['Taste', 'Late Delivery', 'Cold Food', 'Packaging Issue', 'Other'] as const

export default function Reviews() {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([])
  const [showForm, setShowForm] = useState(false)

  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [rating, setRating] = useState(5)
  const [deliveryRating, setDeliveryRating] = useState(5)
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Taste')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function loadReviews() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setReviews((data as Review[]) ?? [])
  }

  async function loadDeliveredOrders() {
    if (!profile) return
    const { data: reviewed } = await supabase.from('reviews').select('order_id').eq('customer_id', profile.id)
    const reviewedIds = new Set((reviewed ?? []).map((r) => r.order_id))

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', profile.id)
      .eq('status', 'delivered')
      .order('placed_at', { ascending: false })

    setDeliveredOrders(((orders as Order[]) ?? []).filter((o) => !reviewedIds.has(o.id)))
  }

  useEffect(() => {
    loadReviews()
    loadDeliveredOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function submitReview() {
    if (!selectedOrderId) { setError('Please select which order you are reviewing.'); return }
    if (!comment.trim()) { setError('Please add a short note describing your dining experience.'); return }

    setSubmitting(true)
    setError(null)

    const { data: firstItem } = await supabase
      .from('order_items')
      .select('menu_item_id')
      .eq('order_id', selectedOrderId)
      .limit(1)
      .single()

    const { error: insertError } = await supabase.from('reviews').insert({
      customer_id: profile!.id,
      order_id: selectedOrderId,
      menu_item_id: firstItem?.menu_item_id ?? null,
      rating,
      category,
      comment: comment.trim(),
    })

    if (insertError) {
      setError('Could not submit your review. Please try again.')
      setSubmitting(false)
      return
    }

    await supabase.from('orders').update({ delivery_rating: deliveryRating }).eq('id', selectedOrderId)

    setSuccess(true)
    setShowForm(false)
    setComment('')
    setSelectedOrderId('')
    loadReviews()
    loadDeliveredOrders()
    setSubmitting(false)
    setTimeout(() => setSuccess(false), 3500)
  }

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '4.9'

  return (
    <AnimatedPage className="max-w-3xl mx-auto px-6 py-12">
      {/* Header Banner */}
      <div className="text-center mb-10 space-y-3">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 bg-saffron-50 text-saffron-700 text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider border border-saffron-200/60"
        >
          <MessageSquareHeart size={13} /> Real Customer Stories
        </motion.span>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-sage-800">
          Reviews & Experiences
        </h1>
        <div className="flex items-center justify-center gap-2 pt-2">
          <div className="flex text-saffron-500">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={20}
                className={i < Math.round(Number(avgRating)) ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'}
              />
            ))}
          </div>
          <span className="font-extrabold text-xl text-sage-800">{avgRating}</span>
          <span className="text-sage-400 text-sm">({reviews.length} authentic ratings)</span>
        </div>
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 text-green-800 border border-green-200 text-sm rounded-2xl p-4 mb-6 text-center font-medium flex items-center justify-center gap-2 shadow-sm"
        >
          <CheckCircle2 size={18} className="text-green-600" />
          Thank you! Your feedback helps us continuously perfect our flavors.
        </motion.div>
      )}

      {profile && deliveredOrders.length > 0 && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-8 py-3.5 text-sm font-bold shadow-lg shadow-saffron-500/20"
        >
          <PenLine size={16} /> Share Your Experience For Recent Order
        </button>
      )}

      {/* Review Modal Form */}
      <AnimatedModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Share Your Dining Experience"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Delivered Order</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-xs font-medium focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              >
                <option value="" disabled>Select your order...</option>
                {deliveredOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8).toUpperCase()} — ₹{o.total.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Feedback Topic</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-xs font-medium focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1.5">Food Flavor Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star
                    size={28}
                    className={n <= rating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1.5">Delivery & Packaging Experience</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDeliveryRating(n)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star
                    size={28}
                    className={n <= deliveryRating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Your Honest Review</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What did you love most about your meal or delivery?"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none leading-relaxed"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-xs py-2.5">
              Cancel
            </button>
            <button
              onClick={submitReview}
              disabled={submitting}
              className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5"
            >
              <Send size={14} /> {submitting ? 'Submitting...' : 'Post Review'}
            </button>
          </div>
        </div>
      </AnimatedModal>

      {/* Reviews Cards List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="card p-12 text-center text-sage-400">
            No customer reviews yet — be the first to share your experience!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="card p-5 space-y-2.5 border-sage-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-saffron-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={15}
                        className={i < r.rating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'}
                      />
                    ))}
                  </div>
                  {r.category && (
                    <span className="text-[11px] font-semibold bg-sage-50 text-sage-700 px-2.5 py-0.5 rounded-full border border-sage-100">
                      {r.category}
                    </span>
                  )}
                </div>
                <p className="text-sage-700 text-sm leading-relaxed">{r.comment}</p>
                <div className="text-[11px] text-sage-400">
                  {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
