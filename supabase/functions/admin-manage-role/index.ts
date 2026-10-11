// Supabase Edge Function: admin-manage-role
// Lets an admin assign a role to an email — if that person has already
// signed up, their profile role is changed immediately. If they haven't
// signed up yet, the role is stored in role_invites and automatically
// applied the moment they do sign up (via the handle_new_user trigger).
//
// action: 'list' | 'set' | 'remove_invite'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req)
  if (preflight) return preflight

  const corsHeaders = getCorsHeaders(req)

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
    if (callerProfile?.role !== 'admin') throw new Error('Only admins can manage roles')

    // Rate Limiting: maximum 60 requests per admin per 10 minutes (600s)
    const { data: rl, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_key: `admin:${user.id}:manage-role`,
      p_max_requests: 60,
      p_window_seconds: 600,
    })

    if (rlErr || (rl && !rl.allowed)) {
      return new Response(
        JSON.stringify({ error: 'Too many admin role management requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const action = body.action

    if (action === 'list') {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, role')
      const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? '(unknown)']))

      const withEmails = (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? '(unknown)' }))
      const { data: invites } = await supabase.from('role_invites').select('*')

      return new Response(JSON.stringify({ users: withEmails, invites: invites ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'set') {
      const { email, role } = body
      if (!email || !role) throw new Error('email and role are required')

      // Try to find an existing signed-up user with this email
      const { data: existingList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = existingList?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

      if (existingUser) {
        await supabase.from('profiles').upsert({ id: existingUser.id, role })
        return new Response(JSON.stringify({ applied: 'immediately', userId: existingUser.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Not signed up yet — pre-assign via role_invites
      await supabase.from('role_invites').upsert({ email: email.toLowerCase(), role })
      return new Response(JSON.stringify({ applied: 'on_next_signup' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'remove_invite') {
      const { email } = body
      await supabase.from('role_invites').delete().eq('email', email)
      return new Response(JSON.stringify({ removed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Unknown action')
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
