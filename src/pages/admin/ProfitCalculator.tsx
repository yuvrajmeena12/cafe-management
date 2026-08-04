import { useMemo, useState } from 'react'
import { Sparkles, IndianRupee, HelpCircle } from 'lucide-react'
import { calculateSellingPrice } from '../../lib/pricing'

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-sage-700 flex items-center gap-1.5 mb-1">
        {label}
        {help && (
          <span className="group relative">
            <HelpCircle size={13} className="text-sage-400 cursor-help" />
            <span className="hidden group-hover:block absolute left-5 top-0 z-10 w-56 bg-sage-800 text-white text-xs rounded-lg p-2 shadow-lg">
              {help}
            </span>
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

export default function ProfitCalculator() {
  const [itemCost, setItemCost] = useState(32)
  const [packagingCost, setPackagingCost] = useState(8)
  const [deliveryCost, setDeliveryCost] = useState(10)
  const [commissionPercent, setCommissionPercent] = useState(25)
  const [gstPercent, setGstPercent] = useState(5)
  const [desiredMarginPercent, setDesiredMarginPercent] = useState(20)

  const result = useMemo(
    () => calculateSellingPrice({ itemCost, packagingCost, deliveryCost, commissionPercent, gstPercent, desiredMarginPercent }),
    [itemCost, packagingCost, deliveryCost, commissionPercent, gstPercent, desiredMarginPercent]
  )

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1 flex items-center gap-2">
        <Sparkles size={28} className="text-saffron-500" /> AI Profit Calculator
      </h1>
      <p className="text-sage-500 mb-6">
        Answer 3 quick questions about one menu item, and this tells you exactly what to charge.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="font-bold text-sage-700 mb-1">Step 1 — What does this item cost you to make?</h2>
            <p className="text-xs text-sage-400 mb-3">Add up everything that goes into one order of this item.</p>
            <div className="space-y-3">
              <Field label="Ingredients (₹)" help="The raw cost of everything in this dish — just the food itself.">
                <input type="number" min="0" value={itemCost} onChange={(e) => setItemCost(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </Field>
              <Field label="Packaging (₹)" help="Boxes, containers, bags — whatever it's served/delivered in.">
                <input type="number" min="0" value={packagingCost} onChange={(e) => setPackagingCost(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </Field>
              <Field label="Delivery (₹)" help="What it costs you to get this to the customer. Leave at 0 for dine-in.">
                <input type="number" min="0" value={deliveryCost} onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </Field>
            </div>
          </div>

          <div className="border-t border-sage-100 pt-4">
            <h2 className="font-bold text-sage-700 mb-1">Step 2 — What gets cut from your price automatically?</h2>
            <p className="text-xs text-sage-400 mb-3">These are taken out no matter what you charge — the government's share and, if it applies, the delivery app's share.</p>
            <div className="space-y-3">
              <Field label="Platform Commission (%)" help="If you sell through Zomato/Swiggy/etc, they take a cut. Set to 0 for direct/dine-in orders with no middleman.">
                <input type="number" min="0" max="90" value={commissionPercent} onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </Field>
              <Field label="GST (%)" help="Standard food service GST rate — check with your accountant if unsure, 5% is common for restaurants.">
                <input type="number" min="0" max="28" value={gstPercent} onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </Field>
            </div>
          </div>

          <div className="border-t border-sage-100 pt-4">
            <h2 className="font-bold text-sage-700 mb-1">Step 3 — How much profit do you actually want?</h2>
            <p className="text-xs text-sage-400 mb-2">Drag to set your target. Higher = more profit per order, but a higher menu price.</p>
            <input type="range" min="5" max="60" value={desiredMarginPercent} onChange={(e) => setDesiredMarginPercent(parseFloat(e.target.value))} className="w-full" />
            <div className="text-sage-700 text-sm font-semibold">{desiredMarginPercent}% profit on every sale</div>
          </div>
        </div>

        <div className="card p-6 bg-sage-700 text-white h-fit sticky top-6">
          <h2 className="font-bold mb-1 flex items-center gap-2"><IndianRupee size={18} /> Here's What to Charge</h2>
          <p className="text-sage-300 text-xs mb-4">Updates instantly as you change anything on the left.</p>

          <div className="bg-sage-600/50 rounded-lg p-4 mb-4 text-center">
            <div className="text-sage-200 text-sm">Set your menu price to</div>
            <div className="text-4xl font-display font-bold my-1">₹{result.suggestedSellingPrice}</div>
            <div className="text-sage-300 text-xs">and you'll keep ₹{result.expectedProfit} profit per order</div>
          </div>

          <div className="space-y-2 text-sm text-sage-100">
            <div className="flex justify-between"><span>Your real cost</span><span>₹{result.totalCost}</span></div>
            <div className="flex justify-between"><span>Platform takes ({commissionPercent}%)</span><span>-₹{result.commissionAmount}</span></div>
            <div className="flex justify-between"><span>GST ({gstPercent}%)</span><span>-₹{result.gstAmount}</span></div>
            <div className="flex justify-between font-bold text-base text-white border-t border-sage-500 pt-2 mt-2">
              <span>You keep</span><span>₹{result.expectedProfit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
