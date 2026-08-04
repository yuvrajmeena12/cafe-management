// Supabase Edge Function: send-test-whatsapp
// Admin-only utility to confirm the Twilio WhatsApp setup is working,
// without needing to place a real order to test it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendWhatsApp } from '../_shared/twilio.ts'

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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can send test messages')

    const { phone } = await req.json()
    if (!phone) throw new Error('phone is required')

    await sendWhatsApp(phone, '✅ Test message from Saffron & Sage — your WhatsApp integration is working correctly!')

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
