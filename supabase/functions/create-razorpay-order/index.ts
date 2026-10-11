// Supabase Edge Function: create-razorpay-order
// Called from the frontend right after an order is placed.
// SECURITY: Enforces caller authentication and ownership/guest authorization.
// The payment amount is derived strictly from the server-calculated order total.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const corsHeaders = getCorsHeaders(req)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const body = await req.json()
    const { orderId, guestToken } = body
    if (!orderId) throw new Error('orderId is required')

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const isServiceRole = Boolean(serviceRoleKey && authHeader.includes(serviceRoleKey))

    // Service role client — bypasses RLS, only ever runs server-side
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey
    )

    // Inspect caller identity if an authorization header is present
    let callerUser: { id: string } | null = null
    let isCallerAdmin = false

    if (authHeader && !isServiceRole) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await userClient.auth.getUser()
      if (user) {
        callerUser = user
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (prof?.role === 'admin') {
          isCallerAdmin = true
        }
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total, payment_status, customer_id, guest_token, razorpay_order_id')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')
    if (order.payment_status === 'paid') throw new Error('Order already paid')

    // Authorization verification:
    // 1. Service role or Admin caller
    // 2. Authenticated user who owns the order
    // 3. Guest customer holding valid guest_token matching order.guest_token
    const isOwner = callerUser && order.customer_id && callerUser.id === order.customer_id
    const isAuthorizedGuest = !order.customer_id && guestToken && order.guest_token && guestToken === order.guest_token

    if (!isServiceRole && !isCallerAdmin && !isOwner && !isAuthorizedGuest) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cannot initiate payment for this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate Limiting: maximum 5 requests per 5 minutes (300s) per order
    const { data: rl, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_key: `order:${orderId}:razorpay`,
      p_max_requests: 5,
      p_window_seconds: 300,
    })

    if (rlErr || (rl && !rl.allowed)) {
      return new Response(
        JSON.stringify({ error: 'Too many payment attempts for this order. Please wait a few minutes before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amountInPaise = Math.round(Number(order.total) * 100)
    if (amountInPaise <= 0) {
      throw new Error('Invalid order amount')
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`)

    // Check whether razorpay_order_id already exists on this order
    if (order.razorpay_order_id) {
      try {
        const existingRes = await fetch(`https://api.razorpay.com/v1/orders/${order.razorpay_order_id}`, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${auth}`,
          },
        })

        if (existingRes.ok) {
          const existingRzp = await existingRes.json()
          // Verify amount, currency, and local order context
          const matchesAmount = existingRzp.amount === amountInPaise
          const matchesCurrency = existingRzp.currency === 'INR'
          const matchesContext = existingRzp.receipt === order.id || existingRzp.notes?.supabase_order_id === order.id
          const isStillPayable = existingRzp.status !== 'paid'

          if (matchesAmount && matchesCurrency && matchesContext && isStillPayable) {
            return new Response(
              JSON.stringify({ razorpayOrderId: existingRzp.id, amount: amountInPaise, currency: 'INR' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (lookupErr) {
        console.warn('Razorpay order lookup warning, reusing existing ID:', lookupErr)
        return new Response(
          JSON.stringify({ razorpayOrderId: order.razorpay_order_id, amount: amountInPaise, currency: 'INR' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Only create a new Razorpay order if no valid existing Razorpay order ID exists
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
