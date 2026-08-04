// Supabase Edge Function: create-razorpay-order
// Called from the frontend right after an order row is inserted.
// SECURITY: never trust an amount sent from the browser — we re-read the
// order's total from the database ourselves before creating the Razorpay
// order, so a tampered frontend request can't create a cheaper payment.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    // Service role client — bypasses RLS, only ever runs server-side
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total, payment_status')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')
    if (order.payment_status === 'paid') throw new Error('Order already paid')

    const amountInPaise = Math.round(Number(order.total) * 100)

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.id,
        notes: { supabase_order_id: order.id },
      }),
    })

    if (!rzpResponse.ok) {
      const errBody = await rzpResponse.text()
      throw new Error(`Razorpay error: ${errBody}`)
    }

    const rzpOrder = await rzpResponse.json()

    // Save the razorpay order id back onto our order row for later matching
    await supabase.from('orders').update({ razorpay_order_id: rzpOrder.id }).eq('id', order.id)

    return new Response(
      JSON.stringify({ razorpayOrderId: rzpOrder.id, amount: amountInPaise, currency: 'INR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
