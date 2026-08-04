// Supabase Edge Function: razorpay-webhook
// Razorpay calls this URL directly (not the browser) after a payment
// succeeds or fails. This is the ONLY place payment_status should ever be
// set to 'paid' — never trust a frontend "success" callback alone, since
// that can be faked by anyone who opens devtools.
//
// Set this function's URL as the webhook endpoint in your Razorpay
// Dashboard → Settings → Webhooks, and give it the same secret you set
// below as RAZORPAY_WEBHOOK_SECRET.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail, orderConfirmationHtml } from '../_shared/resend.ts'
import { sendWhatsApp } from '../_shared/twilio.ts'

function hmacSHA256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  return crypto.subtle
    .importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((cryptoKey) => crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)))
    .then((sig) =>
      Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
    )
}

Deno.serve(async (req) => {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!

  const expectedSignature = await hmacSHA256Hex(webhookSecret, rawBody)

  if (expectedSignature !== signature) {
    // Signature mismatch — this request did not genuinely come from Razorpay.
    return new Response('Invalid signature', { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (event === 'payment.captured') {
    const payment = payload.payload.payment.entity
    const razorpayOrderId = payment.order_id
    const paymentId = payment.id

    const { data: updatedOrder } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', payment_id: paymentId })
      .eq('razorpay_order_id', razorpayOrderId)
      .select('id, customer_name, customer_email, customer_phone, total, subtotal, tax, delivery_charge, discount_amount, order_type')
      .single()

    if (updatedOrder?.customer_email) {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, unit_price, menu_item:menu_items(name)')
        .eq('order_id', updatedOrder.id)

      try {
        await sendEmail(
          updatedOrder.customer_email,
          `Order Confirmed — Saffron & Sage`,
          orderConfirmationHtml({ ...updatedOrder, items: items ?? [] }, Deno.env.get('SITE_URL') ? `${Deno.env.get('SITE_URL')}/invoice/${updatedOrder.id}` : undefined)
        )
      } catch (emailErr) {
        // Don't fail the whole webhook just because the email failed to send —
        // the payment itself is already confirmed and recorded at this point.
        console.error('Failed to send confirmation email:', emailErr)
      }
    }

    if (updatedOrder?.customer_phone) {
      try {
        const siteUrl = Deno.env.get('SITE_URL') // e.g. https://your-cafe-site.vercel.app — set once deployed
        const invoiceLine = siteUrl ? `\n\n🧾 Invoice: ${siteUrl}/invoice/${updatedOrder.id}` : ''
        await sendWhatsApp(
          updatedOrder.customer_phone,
          `🌿 *Saffron & Sage*\n\nThanks ${updatedOrder.customer_name ?? ''}! Your order #${updatedOrder.id.slice(0, 8)} is confirmed.\nTotal: ₹${Number(updatedOrder.total).toFixed(2)}${invoiceLine}\n\nWe'll message you again once it's on its way. Thanks for ordering with us! 💚`
        )
      } catch (waErr) {
        console.error('Failed to send WhatsApp confirmation:', waErr)
      }
    }
  }

  if (event === 'payment.failed') {
    const payment = payload.payload.payment.entity
    const razorpayOrderId = payment.order_id

    await supabase
      .from('orders')
      .update({ payment_status: 'failed' })
      .eq('razorpay_order_id', razorpayOrderId)
  }

  // Always return 200 quickly so Razorpay doesn't retry unnecessarily
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
