// Shared helper — imported by both send-order-email and razorpay-webhook.
// Uses Resend's HTTP API directly (no SDK needed in Deno edge functions).

export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const fromAddress = Deno.env.get('RESEND_FROM_ADDRESS') ?? 'onboarding@resend.dev'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Saffron & Sage <${fromAddress}>`,
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error: ${body}`)
  }

  return res.json()
}

export function orderConfirmationHtml(order: {
  id: string
  customer_name: string | null
  total: number
  subtotal?: number
  tax?: number
  delivery_charge?: number
  discount_amount?: number
  order_type: string
  items: { quantity: number; unit_price: number; menu_item?: { name: string } }[]
}, invoiceUrl?: string) {
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;">${it.quantity}× ${it.menu_item?.name ?? 'Item'}</td><td style="text-align:right;">₹${(it.unit_price * it.quantity).toFixed(2)}</td></tr>`
    )
    .join('')

  const breakdownRows = [
    order.subtotal != null ? `<tr><td style="padding:4px 0; color:#666;">Subtotal</td><td style="text-align:right; color:#666;">₹${order.subtotal.toFixed(2)}</td></tr>` : '',
    order.tax != null ? `<tr><td style="padding:4px 0; color:#666;">Tax</td><td style="text-align:right; color:#666;">₹${order.tax.toFixed(2)}</td></tr>` : '',
    order.delivery_charge ? `<tr><td style="padding:4px 0; color:#666;">Delivery Charge</td><td style="text-align:right; color:#666;">₹${order.delivery_charge.toFixed(2)}</td></tr>` : '',
    order.discount_amount ? `<tr><td style="padding:4px 0; color:#2f7a2f;">Discount</td><td style="text-align:right; color:#2f7a2f;">-₹${order.discount_amount.toFixed(2)}</td></tr>` : '',
  ].join('')

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #2f4a2e;">Thanks for your order, ${order.customer_name ?? 'there'}! 🌿</h2>
      <p>Your order <strong>#${order.id.slice(0, 8)}</strong> (${order.order_type.replace('_', ' ')}) has been received and payment confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">${rows}</table>
      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #eee; padding-top: 8px;">${breakdownRows}</table>
      <p style="font-weight: bold; font-size: 18px; border-top: 2px solid #eee; padding-top: 8px;">Total: ₹${order.total.toFixed(2)}</p>
      ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="color:#d8722a;">View / Print Invoice →</a></p>` : ''}
      <p style="color: #666; font-size: 14px;">We'll notify you as your order moves through preparation. Track it anytime on our website.</p>
      <p style="color: #2f4a2e; font-size: 15px; margin-top: 20px;">Thank you for choosing us — we can't wait to serve you again soon! 💚</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Saffron & Sage · Eat Healthy, Stay Healthy</p>
    </div>
  `
}

export function statusUpdateHtml(order: { id: string; customer_name: string | null; status: string }) {
  const label = order.status.replace(/_/g, ' ')

  if (order.status === 'delivered') {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2f4a2e;">Delivered! 🎉</h2>
        <p>Hi ${order.customer_name ?? 'there'}, your order <strong>#${order.id.slice(0, 8)}</strong> has been delivered.</p>
        <p style="color: #2f4a2e; font-size: 16px; margin-top: 16px;">Thank you for ordering with us — we hope you loved it! We'd love to see you again soon. 💚</p>
        <p style="color: #666; font-size: 14px;">Enjoyed your meal? Leave a review on our website — it helps us a lot.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— Saffron & Sage · Eat Healthy, Stay Healthy</p>
      </div>
    `
  }

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #2f4a2e;">Order Update 🍽️</h2>
      <p>Hi ${order.customer_name ?? 'there'}, your order <strong>#${order.id.slice(0, 8)}</strong> is now:</p>
      <p style="font-size: 20px; font-weight: bold; text-transform: capitalize; color: #d8722a;">${label}</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Saffron & Sage · Eat Healthy, Stay Healthy</p>
    </div>
  `
}
