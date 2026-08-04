import { useEffect, useMemo, useState } from 'react'
import { Star, Trash2, Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import type { Review } from '../../types'

const COLORS: Record<string, string> = {
  'Late Delivery': '#d8722a',
  'Cold Food': '#5c7a5a',
  'Packaging Issue': '#e8873d',
  Taste: '#3d5c3b',
  Other: '#a8a29e',
}

const SUGGESTIONS: Record<string, string> = {
  'Late Delivery': 'Consider reviewing delivery partner assignment times, or adding buffer time to your estimated delivery windows during peak hours.',
  'Cold Food': 'Check packaging insulation, and consider prioritizing dispatch for hot items so they spend less time waiting before pickup.',
  'Packaging Issue': 'Look into sturdier containers or better sealing — this is often the cheapest fix with the biggest impact on repeat orders.',
  Taste: 'Review recipes or portion consistency for the specific items mentioned most in comments below.',
  Other: 'Read through these comments individually — they don\'t fit a common pattern yet.',
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([])

  async function load() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false })
    setReviews((data as Review[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function remove(id: string) {
    if (!confirm('Hide/delete this review?')) return
    await supabase.from('reviews').delete().eq('id', id)
    load()
  }

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'

  const categoryBreakdown = useMemo(() => {
    const categorized = reviews.filter((r) => r.category)
    if (categorized.length === 0) return []
    const counts: Record<string, number> = {}
    categorized.forEach((r) => { counts[r.category!] = (counts[r.category!] ?? 0) + 1 })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / categorized.length) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [reviews])

  const topIssue = categoryBreakdown.find((c) => c.name !== 'Taste' || categoryBreakdown.length === 1) ?? categoryBreakdown[0]

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1">Reviews</h1>
      <p className="text-sage-500 mb-6">Moderate feedback and see what's actually driving it</p>

      <div className="card p-5 mb-6 flex items-center gap-3">
        <Star className="text-saffron-500 fill-saffron-500" />
        <div><div className="text-sage-500 text-sm">Average Rating</div><div className="text-2xl font-bold text-sage-700">{avgRating} / 5 ({reviews.length} reviews)</div></div>
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="bg-sage-700 text-white rounded-xl p-6 mb-6">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Sparkles size={18} /> AI Review Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categoryBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] ?? '#a8a29e'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} reviews`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map((c) => (
                <div key={c.name} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[c.name] ?? '#a8a29e' }} />
                    {c.name}
                  </span>
                  <span className="font-semibold">{c.percent}%</span>
                </div>
              ))}
            </div>
          </div>
          {topIssue && (
            <div className="bg-sage-600/50 rounded-lg p-4 mt-4 text-sm">
              <strong>Biggest pattern:</strong> {topIssue.percent}% of categorized reviews mention <strong>{topIssue.name}</strong>.
              <br />
              <span className="text-sage-200">{SUGGESTIONS[topIssue.name]}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="card p-4 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className={i < r.rating ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />)}
                {r.category && <span className="text-xs bg-sage-50 text-sage-600 px-2 py-0.5 rounded-full">{r.category}</span>}
              </div>
              <p className="text-sage-600 text-sm">{r.comment}</p>
            </div>
            <button onClick={() => remove(r.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
