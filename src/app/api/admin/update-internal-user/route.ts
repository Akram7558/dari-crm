// ─────────────────────────────────────────────────────────────────────
// POST /api/admin/update-internal-user
// ─────────────────────────────────────────────────────────────────────
// Edits an existing internal-team account: change email, set a new
// password, or change role between super_admin / commercial /
// prospecteur_saas. showroom_id always stays NULL — this endpoint is
// for internal users only.
//
// Caller must be authenticated AND have role = 'super_admin'.
//
// Safety guards:
//   - Cannot change own role (a super_admin cannot demote themselves).
//   - Cannot demote the last super_admin (count check before role change).
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin, errorResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

type InternalRole = 'super_admin' | 'commercial' | 'prospecteur_saas'
const INTERNAL_ROLES: InternalRole[] = ['super_admin', 'commercial', 'prospecteur_saas']

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req)

    const body = await req.json().catch(() => ({}))
    const userId   = String(body.user_id ?? '').trim()
    const email    = body.email    !== undefined ? String(body.email).trim().toLowerCase() : undefined
    const password = body.password !== undefined ? String(body.password)                   : undefined
    const role     = body.role     !== undefined ? String(body.role)                       : undefined

    if (!userId)             return NextResponse.json({ error: 'user_id requis.' }, { status: 400 })
    if (email !== undefined && !EMAIL_RX.test(email)) {
      return NextResponse.json({ error: 'Format d’email invalide.' }, { status: 400 })
    }
    if (password !== undefined && password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe (≥ 8 caractères) requis.' }, { status: 400 })
    }
    if (role !== undefined && !INTERNAL_ROLES.includes(role as InternalRole)) {
      return NextResponse.json({ error: 'Rôle invalide pour un utilisateur interne.' }, { status: 400 })
    }

    // ── Service-role admin client ──────────────────────────────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant.' }, { status: 500 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Look up the target user_roles row + verify it's internal ───
    const { data: target, error: tErr } = await admin
      .from('user_roles')
      .select('id, user_id, role, showroom_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (tErr)         return NextResponse.json({ error: tErr.message }, { status: 500 })
    if (!target)      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 })
    if (target.showroom_id) {
      return NextResponse.json({ error: 'Cet utilisateur n’est pas un membre interne.' }, { status: 400 })
    }
    if (!INTERNAL_ROLES.includes(target.role as InternalRole)) {
      return NextResponse.json({ error: 'Cet utilisateur n’est pas un membre interne.' }, { status: 400 })
    }

    // ── Safety guards on role changes ──────────────────────────────
    if (role !== undefined && role !== target.role) {
      // 1. Cannot change own role.
      if (userId === ctx.user.id) {
        return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }, { status: 403 })
      }
      // 2. Cannot demote the last super_admin.
      if (target.role === 'super_admin' && role !== 'super_admin') {
        const { count, error: cErr } = await admin
          .from('user_roles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'super_admin')
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: 'Impossible de rétrograder le dernier Super Admin.' },
            { status: 400 },
          )
        }
      }
    }

    // ── Apply auth.users updates (email / password) ────────────────
    const authUpdates: Record<string, unknown> = {}
    if (email    !== undefined) authUpdates.email    = email
    if (password !== undefined) authUpdates.password = password
    if (Object.keys(authUpdates).length > 0) {
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, authUpdates)
      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 })
      }
    }

    // ── Apply role update ──────────────────────────────────────────
    if (role !== undefined && role !== target.role) {
      const { error: rErr } = await admin
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId)
      if (rErr) {
        return NextResponse.json({ error: rErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
