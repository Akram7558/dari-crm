// ─────────────────────────────────────────────────────────────────────
// GET /api/admin/list-internal-users
// ─────────────────────────────────────────────────────────────────────
// Returns the list of AutoDex internal team members
// (super_admin / commercial / prospecteur_saas) with their real auth
// emails resolved via the service-role admin API. Tenant roles
// (owner/manager/closer/prospecteur) are intentionally excluded —
// those live on the Showrooms page.
//
// Caller must be authenticated AND have role = 'super_admin'.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin, errorResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

type InternalRole = 'super_admin' | 'commercial' | 'prospecteur_saas'
const INTERNAL_ROLES: InternalRole[] = ['super_admin', 'commercial', 'prospecteur_saas']

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req)

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant.' }, { status: 500 })
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Pull internal-role rows from user_roles.
    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles')
      .select('id, user_id, role, showroom_id, created_at')
      .in('role', INTERNAL_ROLES)
      .is('showroom_id', null)
      .order('created_at', { ascending: false })
    if (roleErr) {
      return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }

    if (!roleRows || roleRows.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // 2. Resolve auth emails. The admin API only exposes a paginated
    //    listUsers — we walk pages until we've covered every internal id.
    //    For typical AutoDex scale (≤ a few dozen internal users) one
    //    page is plenty; we still loop defensively up to 5 pages.
    const wanted = new Set(roleRows.map(r => r.user_id as string))
    const emailById = new Map<string, string | null>()
    for (let page = 1; page <= 5 && emailById.size < wanted.size; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      for (const u of data.users) {
        if (wanted.has(u.id)) emailById.set(u.id, u.email ?? null)
      }
      if (data.users.length < 200) break // last page
    }

    const users = roleRows.map(r => ({
      id:         r.id,
      user_id:    r.user_id,
      email:      emailById.get(r.user_id as string) ?? null,
      role:       r.role,
      created_at: r.created_at,
    }))

    return NextResponse.json({ users })
  } catch (err) {
    return errorResponse(err)
  }
}
