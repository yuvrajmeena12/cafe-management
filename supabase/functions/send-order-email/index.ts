// Supabase Edge Function: send-order-email
// Called on order events and status transitions to deliver customer notifications via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail, statusUpdateHtml, orderConfirmationHtml } from '../_shared/resend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { orderId, isNewOrder } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    let emailSent = false

    if (order.customer_email) {
      try {
        let subject = `Order Update: #${order.id.slice(0, 8).toUpperCase()} is now ${order.status.replace(/_/g, ' ')}`
        let html = statusUpdateHtml(order)

        if (isNewOrder || order.status === 'received') {
          subject = `Order Confirmation #${order.id.slice(0, 8).toUpperCase()} — Saffron & Sage`
          html = orderConfirmationHtml(order)
        } else if (order.status === 'delivered') {
          subject = `Your Order #${order.id.slice(0, 8).toUpperCase()} has been delivered! 🌿`
        }

        await sendEmail(order.customer_email, subject, html)
        emailSent = true
      } catch (err) {
        console.error('Email send failed:', err)
      }
    }

    return new Response(JSON.stringify({ sent: { email: emailSent } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
