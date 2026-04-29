// ─────────────────────────────────────────────────────────────────────
// POST /api/admin/create-showroom
// ─────────────────────────────────────────────────────────────────────
// Server-only endpoint (uses SUPABASE_SERVICE_ROLE_KEY) that creates a
// new tenant in three steps:
//   1. Creates the Supabase auth user (email + auto-generated 12-char password)
//   2. Creates the showroom row
//   3. Creates a user_roles row linking the new user to the showroom as 'owner'
// On failure mid-flow, cleanup is attempted to avoid orphaned rows.
//
// The caller MUST be authenticated and have role = 'super_admin'.
// We never expose the service-role key to the browser — the client just
// POSTs JSON and receives the generated temporary password back so it
// can be displayed once.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs' // service-role key requires Node, not Edge

// Send the welcome email via Resend. Returns true on success, false on
// any failure (the caller decides whether to surface the failure).
async function sendWelcomeEmail(owner_email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY missing' }

  // Plain-text body. Kept simple to avoid an HTML template — admins can
  // upgrade to HTML later if desired.
  const text =
`Bonjour,

Votre compte AutoDex CRM a été créé avec succès.

Voici vos identifiants de connexion :
Email : ${owner_email}
Mot de passe : ${password}

Connectez-vous ici : https://www.autodex.store

Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe après votre première connexion.

Pour toute question, contactez-nous à : support@autodex.store

L'équipe AutoDex`

  const html = `<p>Bonjour,</p>
<p>Votre compte AutoDex CRM a été créé avec succès.</p>
<p><strong>Voici vos identifiants de connexion :</strong><br/>
Email : <code>${owner_email}</code><br/>
Mot de passe : <code>${password}</code></p>
<p>Connectez-vous ici : <a href="https://www.autodex.store">https://www.autodex.store</a></p>
<p>Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe après votre première connexion.</p>
<p>Pour toute question, contactez-nous à : <a href="mailto:support@autodex.store">support@autodex.store</a></p>
<p>— L'équipe AutoDex</p>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM ?? 'AutoDex <noreply@autodex.store>',
        to:      [owner_email],
        subject: 'Bienvenue sur AutoDex — Vos identifiants de connexion',
        text,
        html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${errText.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name        = String(body.name        ?? '').trim()
    const city        = String(body.city        ?? '').trim()
    const owner_email = String(body.owner_email ?? '').trim().toLowerCase()
    const password    = String(body.password    ?? '')
    const module_vente    = body.module_vente    !== false   // default true
    const module_location = body.module_location === true    // default false
    const active          = body.active          !== false   // default true

    if (!name)        return NextResponse.json({ error: 'Nom requis.' },          { status: 400 })
    if (!city)        return NextResponse.json({ error: 'Wilaya requise.' },      { status: 400 })
    if (!owner_email) return NextResponse.json({ error: 'Email propriétaire requis.' }, { status: 400 })
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe (≥ 8 caractères) requis.' }, { status: 400 })
    }

    // ── Verify caller is super_admin ────────────────────────────────
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll().map(({ name, value }) => ({ name, value }))
          },
          // No-op — we only read in this handler.
          setAll() {},
        },
      },
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

    const { data: roleRow } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleRow?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    }

    // ── Service-role admin client ──────────────────────────────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY manquant côté serveur.' },
        { status: 500 },
      )
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Create auth user with the password supplied by the super admin.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:         owner_email,
      password,
      email_confirm: true,
    })
    if (createErr || !created.user) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Échec de création du compte.' },
        { status: 400 },
      )
    }
    const newUserId = created.user.id

    // 2. Create the showroom row.
    const { data: shroom, error: shErr } = await admin
      .from('showrooms')
      .insert([{
        name,
        city,
        owner_email,
        module_vente,
        module_location,
        active,
      }])
      .select('id')
      .single()
    if (shErr || !shroom) {
      // Rollback the auth user so we don't leave an orphan account.
      await admin.auth.admin.deleteUser(newUserId).catch(() => {})
      return NextResponse.json(
        { error: shErr?.message ?? 'Échec de création du showroom.' },
        { status: 400 },
      )
    }

    // 3. Create the user_roles binding (role = 'owner').
    const { error: urErr } = await admin
      .from('user_roles')
      .insert([{
        user_id:     newUserId,
        showroom_id: shroom.id,
        role:        'owner',
      }])
    if (urErr) {
      // Rollback the showroom + the auth user.
      await admin.from('showrooms').delete().eq('id', shroom.id).throwOnError().then(() => {}, () => {})
      await admin.auth.admin.deleteUser(newUserId).catch(() => {})
      return NextResponse.json({ error: urErr.message }, { status: 400 })
    }

    // 4. Send the welcome email with the credentials. We do this AFTER the
    //    rows are persisted so a transient email failure doesn't abort the
    //    whole flow — the client decides whether to surface the password
    //    for manual delivery instead.
    const mail = await sendWelcomeEmail(owner_email, password)

    return NextResponse.json({
      ok:           true,
      showroom_id:  shroom.id,
      owner_email,
      email_sent:   mail.ok,
      email_error:  mail.ok ? undefined : mail.error,
      // Only echoed back when email failed, so the super admin can deliver
      // credentials manually. NEVER returned on success.
      temp_password: mail.ok ? undefined : password,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
