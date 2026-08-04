// Shared helper — sends WhatsApp messages via Twilio's API.
// Works immediately with Twilio's free WhatsApp Sandbox for testing.
// For real customers (production), you'll eventually need your own
// approved WhatsApp Business number — see the README section on this.

export async function sendWhatsApp(toPhone: string, body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM') // e.g. 'whatsapp:+14155238886'

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio secrets are not fully set (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)')
  }

  // Normalize the customer's number into E.164-ish format with whatsapp: prefix.
  // Assumes Indian numbers by default (+91) if no country code was entered.
  let digits = toPhone.replace(/[^\d+]/g, '')
  if (!digits.startsWith('+')) {
    digits = digits.length === 10 ? `+91${digits}` : `+${digits}`
  }
  const to = `whatsapp:${digits}`

  const auth = btoa(`${accountSid}:${authToken}`)
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: fromNumber, To: to, Body: body }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Twilio error: ${errBody}`)
  }

  return res.json()
}
