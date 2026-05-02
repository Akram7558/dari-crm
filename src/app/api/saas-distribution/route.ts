// ─────────────────────────────────────────────────────────────────────
// /api/saas-distribution
//   GET  — read distribution table (super_admin + commercial)
//   PUT  — upsert entries (super_admin only)
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  requireInternalUser, requireSuperAdmin, ApiError, errorResponse,
} from '@/lib/api-auth'

export const runtime = 'nodejs'

const PERCENT_TOLERANCE = 0.01
const DAY_MS = 24 * 60 * 60 * 1000

function ensureSuperOrCommercial(role: string) {
  if (role !== 'super_admin' && role !== 'commercial') {
    throw new ApiError(403, 'Accès refusé.')
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new ApiError(500, 'Service role key missing.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ── GET ─────────────────────────────────────────────────────────────
// Returns distribution rows enriched with auth.users emails + RDV counts,
// plus the list of all `commercial` users so the UI can offer adding any
// commercial that's missing from the table.
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireInternalUser(req)
    ensureSuperOrCommercial(ctx.role)

    const admin = adminClient()

    // 1. Distribution rows.
    const { data: rows, error: rErr } = await admin
      .from('saas_rdv_distribution')
      .select('*')
      .order('percentage', { ascending: false })
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    // 2. All commercials (for "add to distribution" dropdown).
    const { data: commercials, error: cErr } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'commercial')
      .is('showroom_id', null)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    // 3. Resolve auth emails (admin API, paginated).
    const wantedIds = new Set<string>([
      ...(rows ?? []).map(r => r.user_id as string),
      ...(commercials ?? []).map(c => c.user_id as string),
    ])
    const emailById = new Map<string, string | null>()
    for (let page = 1; page <= 5 && emailById.size < wantedIds.size; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      for (const u of data.users) if (wantedIds.has(u.id)) emailById.set(u.id, u.email ?? null)
      if (data.users.length < 200) break
    }

    // 4. RDV counts per assignee (total + last 30 days).
    const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString()
    const [{ data: totalRows }, { data: recentRows }] = await Promise.all([
      admin.from('super_admin_rdv').select('assigned_to').not('assigned_to', 'is', null),
      admin.from('super_admin_rdv').select('assigned_to').not('assigned_to', 'is', null).gte('created_at', since30),
    ])
    const totalByUser  = new Map<string, number>()
    const recentByUser = new Map<string, number>()
    for (const r of (totalRows  ?? []) as { assigned_to: string }[]) {
      totalByUser.set(r.assigned_to, (totalByUser.get(r.assigned_to) ?? 0) + 1)
    }
    for (const r of (recentRows ?? []) as { assigned_to: string }[]) {
      recentByUser.set(r.assigned_to, (recentByUser.get(r.assigned_to) ?? 0) + 1)
    }

    const entries = (rows ?? []).map(r => ({
      id:                r.id,
      user_id:           r.user_id,
      email:             emailById.get(r.user_id as string) ?? null,
      percentage:        Number(r.percentage),
      active:            !!r.active,
      last_assigned_at:  r.last_assigned_at,
      rdv_count_total:   totalByUser.get(r.user_id  as string) ?? 0,
      rdv_count_30days:  recentByUser.get(r.user_id as string) ?? 0,
    }))

    const knownIds = new Set(entries.map(e => e.user_id))
    const availableCommercials = (commercials ?? [])
      .map(c => ({
        user_id: c.user_id as string,
        email:   emailById.get(c.user_id as string) ?? null,
      }))
      .filter(c => !knownIds.has(c.user_id))

    return NextResponse.json({ entries, available_commercials: availableCommercials })
  } catch (err) {
    return errorResponse(err)
  }
}

// ── PUT ─────────────────────────────────────────────────────────────
// Body: { entries: [{ user_id, percentage, active }] }
// Upserts each entry — never deletes (use DELETE /[user_id] for that).
// Validates the sum of active percentages == 100.
export async function PUT(req: NextRequest) {
  try {
    await requireSuperAdmin(req)

    const body = await req.json().catch(() => ({}))
    const incoming = Array.isArray(body?.entries) ? body.entries : null
    if (!incoming) return NextResponse.json({ error: 'entries[] requis.' }, { status: 400 })

    type Entry = { user_id: string; percentage: number; active: boolean }
    const cleaned: Entry[] = []
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') {
        return NextResponse.json({ error: 'Entrée invalide.' }, { status: 400 })
      }
      const user_id = String(raw.user_id ?? '').trim()
      if (!user_id) return NextResponse.json({ error: 'user_id manquant.' }, { status: 400 })
      const percentage = Number(raw.percentage)
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        return NextResponse.json(
          { error: `Pourcentage invalide pour ${user_id} (0–100 attendu).` },
          { status: 400 },
        )
      }
      const active = raw.active !== false
      cleaned.push({ user_id, percentage, active })
    }

    // Sum-of-active check.
    const activeTotal = cleaned
      .filter(e => e.active)
      .reduce((acc, e) => acc + e.percentage, 0)
    if (Math.abs(activeTotal - 100) > PERCENT_TOLERANCE) {
      return NextResponse.json(
        { error: 'La somme des pourcentages actifs doit être égale à 100%.' },
        { status: 400 },
      )
    }

    // Verify each user_id is actually a commercial.
    const admin = adminClient()
    const ids = cleaned.map(e => e.user_id)
    const { data: roles, error: rErr } = await admin
      .from('user_roles')
      .select('user_id, role, showroom_id')
      .in('user_id', ids)
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
    const validIds = new Set(
      (roles ?? [])
        .filter(r => r.role === 'commercial' && !r.showroom_id)
        .map(r => r.user_id as string),
    )
    for (const e of cleaned) {
      if (!validIds.has(e.user_id)) {
        return NextResponse.json(
          { error: `${e.user_id} n'est pas un commercial.` },
          { status: 400 },
        )
      }
    }

    // Upsert.
    const { data, error } = await admin
      .from('saas_rdv_distribution')
      .upsert(
        cleaned.map(e => ({
          user_id:    e.user_id,
          percentage: e.percentage,
          active:     e.active,
        })),
        { onConflict: 'user_id' },
      )
      .select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true, entries: data ?? [] })
  } catch (err) {
    return errorResponse(err)
  }
}
