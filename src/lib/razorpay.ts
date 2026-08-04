/**
 * Frontend-side Razorpay helper.
 * The ORDER must be created server-side (edge function) so the amount
 * can't be tampered with in the browser. This file only opens the
 * Razorpay Checkout modal once you already have an order_id from your backend.
 */

declare global {
  interface Window {
    Razorpay: any
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

interface OpenCheckoutArgs {
  razorpayOrderId: string
  amountInPaise: number
  cafeName: string
  customerName: string
  customerEmail: string
  customerPhone: string
  onSuccess: (paymentId: string) => void
  onFailure: (error: any) => void
}

export async function openRazorpayCheckout(args: OpenCheckoutArgs) {
  const loaded = await loadRazorpayScript()
  if (!loaded) {
    args.onFailure(new Error('Razorpay SDK failed to load'))
    return
  }

  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    amount: args.amountInPaise,
    currency: 'INR',
    name: args.cafeName,
    description: 'Order payment',
    order_id: args.razorpayOrderId,
    prefill: {
      name: args.customerName,
      email: args.customerEmail,
      contact: args.customerPhone,
    },
    theme: { color: '#d8722a' },
    handler: (response: any) => args.onSuccess(response.razorpay_payment_id),
    modal: { ondismiss: () => args.onFailure(new Error('Payment cancelled')) },
  }

  const rzp = new window.Razorpay(options)
  rzp.open()
}
