// Supabase Edge Function: send-offer-broadcast
// Dispatches promotional discount emails to registered cafe customers via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail, offerBroadcastHtml } from '../_shared/resend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can send offer broadcasts')

    const { discountId } = await req.json()
    if (!discountId) throw new Error('discountId is required')

    const { data: discount, error: discountErr } = await supabase
      .from('discounts')
      .select('*')
      .eq('id', discountId)
      .single()
    if (discountErr || !discount) throw new Error('Discount not found')

    // Fetch all customers or users from auth / profiles
    const { data: authUsers, error: usersErr } = await supabase.auth.admin.listUsers()
    if (usersErr) throw new Error('Could not retrieve customer email directory')

    const targetEmails = (authUsers?.users ?? [])
      .map((u) => u.email)
      .filter((e): e is string => !!e && e.includes('@'))

    const subject = `Exclusive Offer: Get ${discount.type === 'percent' ? `${discount.value}% OFF` : `₹${discount.value} OFF`} with code ${discount.code} 🌿`
    const html = offerBroadcastHtml(discount)

    let sent = 0
    let failed = 0

    for (const email of targetEmails) {
      try {
        await sendEmail(email, subject, html)
        sent++
      } catch {
        failed++
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: targetEmails.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
