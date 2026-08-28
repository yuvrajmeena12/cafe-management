// Supabase Edge Function: send-test-email
// Admin diagnostic utility to verify Resend API integration.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { sendEmail } from '../_shared/resend.ts'

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
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can test email connectivity')

    const { email } = await req.json()
    if (!email) throw new Error('Email address is required')

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2ebd9; border-radius: 12px;">
        <h2 style="color: #2f4a2e; margin-top: 0;">Saffron & Sage Email System</h2>
        <p style="color: #4a5568;">✅ Your Resend transactional email integration is functioning properly!</p>
        <p style="color: #718096; font-size: 13px;">Sent from Saffron & Sage Management Portal on ${new Date().toLocaleString('en-IN')}</p>
      </div>
    `

    await sendEmail(email, '✅ Test Email from Saffron & Sage', html)

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
