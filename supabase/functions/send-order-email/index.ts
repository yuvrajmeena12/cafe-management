// Supabase Edge Function: send-order-email
// Called whenever an order's status changes (Received → Preparing →
// Ready → Out for Delivery → Delivered) — sends both an email and a
// WhatsApp message, whichever contact details are on file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail, statusUpdateHtml } from '../_shared/resend.ts'
import { sendWhatsApp } from '../_shared/twilio.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_email, customer_phone, status')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const results: Record<string, boolean> = { email: false, whatsapp: false }

    if (order.customer_email) {
      try {
        await sendEmail(
          order.customer_email,
          order.status === 'delivered' ? `Delivered! Thanks for ordering — Saffron & Sage` : `Your order is now ${order.status.replace(/_/g, ' ')} — Saffron & Sage`,
          statusUpdateHtml(order)
        )
        results.email = true
      } catch (err) {
        console.error('Email send failed:', err)
      }
    }

    if (order.customer_phone) {
      try {
        const message = order.status === 'delivered'
          ? `🌿 *Saffron & Sage*\n\nYour order #${order.id.slice(0, 8)} has been delivered! 🎉\n\nThank you for ordering with us, ${order.customer_name ?? 'there'} — we hope you loved it. We'd love to see you again soon! 💚\n\nHow was your delivery? Let us know by leaving a review on our site.`
          : `🌿 *Saffron & Sage*\n\nHi ${order.customer_name ?? 'there'}! Your order #${order.id.slice(0, 8)} is now:\n*${order.status.replace(/_/g, ' ').toUpperCase()}*`
        await sendWhatsApp(order.customer_phone, message)
        results.whatsapp = true
      } catch (err) {
        console.error('WhatsApp send failed:', err)
      }
    }

    return new Response(JSON.stringify({ sent: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
