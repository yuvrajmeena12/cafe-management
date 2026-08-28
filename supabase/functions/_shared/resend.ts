// Shared helper — imported by send-order-email, send-offer-broadcast, send-test-email, and razorpay-webhook.
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
        `<tr><td style="padding:8px 0; border-bottom: 1px solid #f0f0f0;">${it.quantity}× <strong>${it.menu_item?.name ?? 'Item'}</strong></td><td style="text-align:right; padding:8px 0; border-bottom: 1px solid #f0f0f0;">₹${(it.unit_price * it.quantity).toFixed(2)}</td></tr>`
    )
    .join('')

  const breakdownRows = [
    order.subtotal != null ? `<tr><td style="padding:4px 0; color:#666;">Subtotal</td><td style="text-align:right; color:#666;">₹${order.subtotal.toFixed(2)}</td></tr>` : '',
    order.tax != null ? `<tr><td style="padding:4px 0; color:#666;">Tax (GST)</td><td style="text-align:right; color:#666;">₹${order.tax.toFixed(2)}</td></tr>` : '',
    order.delivery_charge ? `<tr><td style="padding:4px 0; color:#666;">Delivery Charge</td><td style="text-align:right; color:#666;">₹${order.delivery_charge.toFixed(2)}</td></tr>` : '',
    order.discount_amount ? `<tr><td style="padding:4px 0; color:#2f7a2f; font-weight:600;">Discount Applied</td><td style="text-align:right; color:#2f7a2f; font-weight:600;">-₹${order.discount_amount.toFixed(2)}</td></tr>` : '',
  ].join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e8ede5; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: #2f4a2e; color: #ffffff; padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Saffron & Sage</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #e8873d; font-style: italic;">Eat Healthy, Stay Healthy</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #2f4a2e; font-size: 20px; margin-top: 0;">Order Confirmed! 🌿</h2>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.5;">Hi ${order.customer_name ?? 'Valued Customer'}, thank you for dining with us. Your order <strong>#${order.id.slice(0, 8).toUpperCase()}</strong> (${order.order_type.replace('_', ' ')}) has been received and sent to the kitchen.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0 12px 0;">${rows}</table>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">${breakdownRows}</table>
        
        <div style="background: #fcf8f2; border: 1px solid #f0e6d6; padding: 14px 18px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 16px; color: #2f4a2e;">Total Paid:</span>
          <span style="font-weight: 800; font-size: 20px; color: #e8873d;">₹${order.total.toFixed(2)}</span>
        </div>

        ${invoiceUrl ? `<div style="text-align: center; margin-top: 24px;"><a href="${invoiceUrl}" style="background: #e8873d; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Download Official Invoice</a></div>` : ''}

        <p style="color: #718096; font-size: 13px; margin-top: 28px; line-height: 1.5; border-top: 1px solid #edf2f7; padding-top: 16px;">
          Track live kitchen prep & delivery milestones directly on our portal. If you have special dietary questions, reply directly to this email.
        </p>
      </div>
      <div style="background: #f7faf6; padding: 16px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0;">
        © Saffron & Sage Cafe · Healthy Artisanal Culinary Experience
      </div>
    </div>
  `
}

export function statusUpdateHtml(order: { id: string; customer_name: string | null; status: string }) {
  const label = order.status.replace(/_/g, ' ')

  if (order.status === 'delivered') {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e8ede5; border-radius: 16px; overflow: hidden;">
        <div style="background: #2f4a2e; color: #ffffff; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Saffron & Sage</h1>
        </div>
        <div style="padding: 28px; text-align: center;">
          <div style="font-size: 44px; margin-bottom: 12px;">🎉</div>
          <h2 style="color: #2f4a2e; font-size: 22px; margin: 0 0 8px 0;">Delivered! Enjoy Your Meal</h2>
          <p style="color: #4a5568; font-size: 15px; line-height: 1.5;">
            Hi ${order.customer_name ?? 'there'}, your order <strong>#${order.id.slice(0, 8).toUpperCase()}</strong> has arrived!
          </p>
          <p style="color: #718096; font-size: 14px; margin-top: 16px;">
            We hope you love every bite. Please leave a review on our website to help us keep improving.
          </p>
        </div>
      </div>
    `
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e8ede5; border-radius: 16px; overflow: hidden;">
      <div style="background: #2f4a2e; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">Saffron & Sage</h1>
      </div>
      <div style="padding: 28px; text-align: center;">
        <h2 style="color: #2f4a2e; font-size: 20px; margin: 0 0 12px 0;">Order Status Update</h2>
        <p style="color: #4a5568; font-size: 15px;">
          Hi ${order.customer_name ?? 'there'}, your order <strong>#${order.id.slice(0, 8).toUpperCase()}</strong> is now:
        </p>
        <div style="display: inline-block; background: #fef5ee; border: 2px solid #e8873d; color: #e8873d; font-size: 18px; font-weight: 700; padding: 8px 24px; border-radius: 9999px; text-transform: uppercase; margin: 16px 0;">
          ${label}
        </div>
      </div>
    </div>
  `
}

export function offerBroadcastHtml(discount: {
  code: string
  type: string
  value: number
  min_order_value: number
  valid_to: string | null
}) {
  const discountText = discount.type === 'percent' ? `${discount.value}% OFF` : `₹${discount.value} OFF`
  const validText = discount.valid_to
    ? `Valid until ${new Date(discount.valid_to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Limited time offer'

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e8ede5; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: #2f4a2e; color: #ffffff; padding: 28px; text-align: center;">
        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Special Invitation</span>
        <h1 style="margin: 12px 0 4px 0; font-size: 26px; font-weight: 700;">Special Feast Just For You</h1>
        <p style="margin: 0; font-size: 14px; color: #e8873d;">Saffron & Sage · Eat Healthy, Stay Healthy</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <div style="background: #fef5ee; border: 2px dashed #e8873d; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #666; text-transform: uppercase;">Use Promo Code</p>
          <div style="font-size: 32px; font-weight: 900; color: #2f4a2e; letter-spacing: 2px;">${discount.code}</div>
          <div style="font-size: 20px; font-weight: 800; color: #e8873d; margin-top: 8px;">GET ${discountText}</div>
        </div>

        <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin: 0 0 8px 0;">
          ${discount.min_order_value > 0 ? `Applicable on all orders above ₹${discount.min_order_value}.` : 'No minimum order required.'}
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin: 0 0 24px 0;">${validText}</p>

        <a href="https://saffronsage.cafe/menu" style="background: #2f4a2e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">
          Browse Menu & Order Now →
        </a>
      </div>
    </div>
  `
}
