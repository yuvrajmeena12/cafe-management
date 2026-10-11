// Supabase Edge Function: razorpay-webhook
// Razorpay calls this URL directly (server-to-server) after a payment succeeds or fails.
// SECURITY & INTEGRITY:
// - Cryptographically verified HMAC-SHA256 signature using timing-safe comparison
// - Atomic database RPC execution via process_razorpay_webhook_event
// - Transactionally coupled event claim, amount/currency validation, and payment state transition
// - Replay-resistant and retry-safe: transient failures roll back cleanly and allow retries
// - Strict payment downgrade prevention (paid orders can never be downgraded to failed)
// - Email confirmation triggered exactly once upon legitimate state transition

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail, orderConfirmationHtml } from '../_shared/resend.ts'

// Compute HMAC-SHA256 hex digest using Web Crypto API
async function hmacSHA256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Compute SHA-256 hash of payload text for audit integrity
async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(message))
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Constant-time string comparison to prevent timing side-channel attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not configured in environment')
    return new Response(JSON.stringify({ error: 'Server webhook configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const expectedSignature = await hmacSHA256Hex(webhookSecret, rawBody)

  if (!timingSafeEqual(expectedSignature, signature)) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const event = typeof payload.event === 'string' ? payload.event : ''
  const payloadObj = payload.payload as Record<string, unknown> | undefined
  const paymentObj = payloadObj?.payment as Record<string, unknown> | undefined
  const payment = paymentObj?.entity as Record<string, unknown> | undefined

  if (!event || !payment) {
    return new Response(JSON.stringify({ error: 'Invalid payload structure: missing event or payment entity' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const paymentId = typeof payment.id === 'string' ? payment.id : ''
  const razorpayOrderId = typeof payment.order_id === 'string' ? payment.order_id : ''
  const paymentAmount = typeof payment.amount === 'number' ? payment.amount : 0
  const currency = typeof payment.currency === 'string' ? payment.currency : ''

  if (!paymentId || !razorpayOrderId) {
    return new Response(JSON.stringify({ error: 'Missing payment id or order_id in payment entity' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Derive stable event delivery ID from header, body, or deterministic fallback
  const headerEventId = req.headers.get('x-razorpay-event-id')
  const eventId = headerEventId ||
    (typeof payload.event_id === 'string' ? payload.event_id : `${event}:${paymentId}:${payment.status || 'event'}`)

  const payloadHash = await sha256Hex(rawBody)

  // Service role client runs server-side to execute atomic database RPC
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Execute atomic PostgreSQL RPC: couples event-claim, order lookup, amount check,
  // payment status transition, and audit recording inside a single transaction.
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'process_razorpay_webhook_event',
    {
      p_event_id: eventId,
      p_event_type: event,
      p_razorpay_order_id: razorpayOrderId,
      p_payment_id: paymentId,
      p_amount_paise: paymentAmount,
      p_currency: currency,
      p_payload_hash: payloadHash,
    }
  )

  if (rpcError) {
    console.error('Atomic webhook RPC error:', rpcError)
    // Return 500 to signal retryable failure to Razorpay
    return new Response(JSON.stringify({ error: 'Database transaction error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const resultStatus = rpcResult?.status

  // Non-retryable client validation errors
  if (resultStatus === 'order_not_found' || resultStatus === 'amount_mismatch') {
    return new Response(JSON.stringify({ error: rpcResult?.error || resultStatus }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // If this exact request legitimately transitioned the order to paid, send confirmation email
  if (resultStatus === 'payment_captured' && rpcResult?.should_send_email) {
    const orderData = rpcResult.order_data
    if (orderData?.customer_email) {
      try {
        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, unit_price, menu_item:menu_items(name)')
          .eq('order_id', orderData.id)

        const siteUrl = Deno.env.get('SITE_URL')
        await sendEmail(
          orderData.customer_email,
          `Order Confirmed #${orderData.id.slice(0, 8).toUpperCase()} — Saffron & Sage`,
          orderConfirmationHtml(
            { ...orderData, items: items ?? [] },
            siteUrl ? `${siteUrl}/invoice/${orderData.id}` : undefined
          )
        )
      } catch (emailErr) {
        console.error('Failed to send order confirmation email:', emailErr)
        // Email failure does not invalidate payment capture acknowledgment
      }
    }
  }

  // All successful, idempotent duplicate, or safely ignored events return HTTP 200
  return new Response(JSON.stringify({ received: true, status: resultStatus }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
