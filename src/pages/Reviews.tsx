import { useEffect, useState } from 'react'
import { Star, PenLine, Send } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
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
    if (!selectedOrderId) { setError('Please select which order you\'re reviewing.'); return }
    if (!comment.trim()) { setError('Please add a short comment describing your experience.'); return }

    setSubmitting(true)
    setError(null)

    // Quietly attach the review to the order's first item, so "Most Rated"
    // sorting on the Menu page still has something to work with — the
    // customer only ever sees the simple reason dropdown, not an item picker.
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
    setTimeout(() => setSuccess(false), 3000)
  }

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 bg-saffron-50 text-saffron-600 text-sm font-medium px-4 py-1.5 rounded-full mb-3">
          <Star size={14} className="fill-saffron-500 text-saffron-500" /> Customer Love
        </span>
        <h1 className="font-display text-4xl font-bold text-sage-700 mb-2">Reviews & Ratings</h1>
        <div className="flex items-center justify-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} className={i < Math.round(Number(avgRating)) ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />)}
          </div>
          <span className="font-bold text-sage-700">{avgRating}</span>
          <span className="text-sage-400">({reviews.length} reviews)</span>
        </div>
      </div>

      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3 mb-5 text-center">Thanks for your feedback!</div>}

      {profile && deliveredOrders.length > 0 && !showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary w-full flex items-center justify-center gap-2 mb-8">
          <PenLine size={16} /> Share Your Experience
        </button>
      )}

      {profile && deliveredOrders.length === 0 && !showForm && (
        <p className="text-sm text-sage-400 mb-8 text-center">
          Once you've received a delivered order, you'll be able to leave a review for it here.
        </p>
      )}

      {showForm && (
        <div className="card p-6 mb-8 space-y-4">
          <h2 className="font-bold text-sage-700 text-lg">Share Your Experience</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Which order?</label>
              <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                <option value="" disabled>Select order</option>
                {deliveredOrders.map((o) => (
                  <option key={o.id} value={o.id}>#{o.id.slice(0, 8)} — ₹{o.total.toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">What's this about?</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Your rating (food)</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star size={28} className={n <= rating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Rate your delivery rider</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setDeliveryRating(n)}>
                  <Star size={28} className={n <= deliveryRating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Tell us about your experience</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Tell us about your experience..."
              className="w-full px-4 py-2 rounded-lg border border-sage-100"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitReview} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Send size={15} /> {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sage-400 text-center py-10">No reviews yet — be the first to order and share your experience!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className={i < r.rating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />
                  ))}
                </div>
                {r.category && <span className="text-xs bg-sage-50 text-sage-600 px-2 py-1 rounded-full">{r.category}</span>}
              </div>
              <p className="text-sage-600">{r.comment}</p>
              <p className="text-xs text-sage-400 mt-1">{new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
