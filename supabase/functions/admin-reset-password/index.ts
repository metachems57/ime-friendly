import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ ok: false, reason: 'misconfigured' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
      return json({ ok: false, reason: 'forbidden' }, 401)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData?.user) {
      return json({ ok: false, reason: 'forbidden' }, 403)
    }

    const currentUserId = authData.user.id
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from('profiles')
      .select('role, is_validated')
      .eq('id', currentUserId)
      .maybeSingle()

    const role = String(adminProfile?.role || '').trim().toLowerCase()
    const isValidated = !!adminProfile?.is_validated

    if (adminProfileError || role !== 'admin' || !isValidated) {
      return json({ ok: false, reason: 'forbidden' }, 403)
    }

    const payload = await req.json().catch(() => null)
    const email = normalizeEmail(payload?.email)
    const newPassword = String(payload?.newPassword || '')

    if (!email || !email.includes('@')) {
      return json({ ok: false, reason: 'invalid_email' }, 400)
    }

    if (newPassword.length < 8) {
      return json({ ok: false, reason: 'weak_password' }, 400)
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (targetProfileError) {
      return json({ ok: false, reason: 'db_error' }, 500)
    }

    if (!targetProfile?.id) {
      return json({ ok: false, reason: 'not_found' }, 404)
    }

    if (targetProfile.id === currentUserId) {
      return json({ ok: false, reason: 'forbidden_self' }, 403)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetProfile.id,
      {
        password: newPassword,
        email_confirm: true,
      }
    )

    if (updateError) {
      const message = String(updateError.message || '').toLowerCase()
      if (message.includes('user not found')) {
        return json({ ok: false, reason: 'not_found' }, 404)
      }
      return json({ ok: false, reason: 'update_failed' }, 500)
    }

    await adminClient
      .from('profiles')
      .update({ is_validated: true })
      .eq('id', targetProfile.id)

    return json({ ok: true, profileId: targetProfile.id })
  } catch (_error) {
    return json({ ok: false, reason: 'server_error' }, 500)
  }
})
