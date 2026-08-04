// Supabase Edge Function: send-offer-broadcast
// Admin-triggered: composes a ready-to-send WhatsApp message for a given
// discount (code, amount, minimum order, valid-until date) and sends it
// to every customer who has opted in and has a phone number on file.
//
// Deliberately template-based rather than a free-form LLM call — every
// message is predictable and reviewable, and there's no risk of an AI
// inventing incorrect offer details.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendWhatsApp } from '../_shared/twilio.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function composeOfferMessage(discount: any): string {
  const discountText = discount.type === 'percent' ? `${discount.value}% OFF` : `₹${discount.value} OFF`
  const validTo = discount.valid_to
    ? new Date(discount.valid_to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  let msg = `🎉 *Saffron & Sage Offer!*\n\nUse code *${discount.code}* to get *${discountText}* on your next order!\n`
  if (discount.min_order_value > 0) msg += `✅ Valid on orders above ₹${discount.min_order_value}\n`
  if (validTo) msg += `⏰ Valid till ${validTo}\n`
  msg += `\nOrder now and treat yourself! 🌿\n— Saffron & Sage, Eat Healthy Stay Healthy`
  return msg
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the caller is actually logged in and is an admin — this
    // function can message your entire customer list, so it must not be
    // callable by just any authenticated user.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can send offer broadcasts')

    const { discountId } = await req.json()
    if (!discountId) throw new Error('discountId is required')

    const { data: discount, error: discountErr } = await supabase
      .from('discounts')
      .select('*')
      .eq('id', discountId)
      .single()
    if (discountErr || !discount) throw new Error('Discount not found')

    const { data: customers } = await supabase
      .from('profiles')
      .select('phone')
      .eq('role', 'customer')
      .eq('whatsapp_opt_in', true)
      .not('phone', 'is', null)

    const message = composeOfferMessage(discount)
    let sent = 0
    let failed = 0

    for (const c of customers ?? []) {
      try {
        await sendWhatsApp(c.phone, message)
        sent++
      } catch {
        failed++
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: (customers ?? []).length, preview: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
