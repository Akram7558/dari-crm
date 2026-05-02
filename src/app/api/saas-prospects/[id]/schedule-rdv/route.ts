// ─────────────────────────────────────────────────────────────────────
// POST /api/saas-prospects/[id]/schedule-rdv
// ─────────────────────────────────────────────────────────────────────
// Atomic flow that:
//   1. Picks the next commercial via saas_pick_next_commercial()
//   2. Inserts a super_admin_rdv row for the prospect
//   3. Sets the prospect's suivi to 'rdv_planifie'
//
// If step 3 fails, step 2 is rolled back so we never end up with an
// orphan RDV. prospecteur_saas is denied (403) — only super_admin and
// commercial can schedule SaaS RDVs.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { requireInternalUser, ApiError, errorResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000  // 5min clock-skew slack

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const ctx = await requireInternalUser(req)
    if (ctx.role === 'prospecteur_saas') {
      throw new ApiError(403, "Vous n'avez pas la permission de créer un RDV.")
    }

    const { id: prospectId } = await params
    if (!prospectId) return NextResponse.json({ error: 'id requis.' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const scheduledRaw = String(body.scheduled_at ?? '').trim()
    const notes        = body.notes ? String(body.notes) : null
    if (!scheduledRaw) return NextResponse.json({ error: 'Date du RDV requise.' }, { status: 400 })

    const scheduled = new Date(scheduledRaw)
    if (Number.isNaN(scheduled.getTime())) {
      return NextResponse.json({ error: 'Date du RDV invalide.' }, { status: 400 })
    }
    if (scheduled.getTime() < Date.now() - FUTURE_TOLERANCE_MS) {
      return NextResponse.json({ error: 'La date du RDV doit être dans le futur.' }, { status: 400 })
    }

    // Verify the prospect is visible to the caller (RLS).
    const { data: prospect, error: pErr } = await ctx.authSb
      .from('super_admin_prospects')
      .select('id, suivi')
      .eq('id', prospectId)
      .maybeSingle()
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!prospect) return NextResponse.json({ error: 'Prospect introuvable.' }, { status: 404 })

    // Step 1 — pick next commercial via the SQL function (RLS-aware).
    const { data: pickedId, error: pickErr } = await ctx.authSb
      .rpc('saas_pick_next_commercial')
    if (pickErr) return NextResponse.json({ error: pickErr.message }, { status: 500 })
    const pickedUserId = (pickedId as string | null) ?? null

    // Step 2 — insert RDV (RLS allows super_admin / commercial).
    const { data: rdv, error: rdvErr } = await ctx.authSb
      .from('super_admin_rdv')
      .insert([{
        prospect_id:  prospectId,
        scheduled_at: scheduled.toISOString(),
        notes,
        status:       'planifie',
        assigned_to:  pickedUserId,
        // created_by stamped by BEFORE INSERT trigger.
      }])
      .select('*')
      .single()
    if (rdvErr) return NextResponse.json({ error: rdvErr.message }, { status: 400 })

    // Step 3 — flip the prospect's suivi to rdv_planifie. If this fails,
    // roll back the RDV so we don't leave an orphan record.
    const { error: suiviErr } = await ctx.authSb
      .from('super_admin_prospects')
      .update({ suivi: 'rdv_planifie' })
      .eq('id', prospectId)
    if (suiviErr) {
      await ctx.authSb.from('super_admin_rdv').delete().eq('id', rdv.id).throwOnError().then(
        () => {}, () => {},
      )
      return NextResponse.json({ error: suiviErr.message }, { status: 400 })
    }

    // Resolve the assigned email + percentage for the response (best-effort).
    let assigned: { user_id: string; email: string | null; percentage: number | null } | null = null
    if (pickedUserId) {
      const { data: entry } = await ctx.authSb
        .from('saas_rdv_distribution')
        .select('percentage')
        .eq('user_id', pickedUserId)
        .maybeSingle()
      assigned = {
        user_id:    pickedUserId,
        email:      null,
        percentage: entry ? Number(entry.percentage) : null,
      }
    }

    if (assigned) {
      // The current user is internal; we use the regular auth client to
      // try resolving the assignee's email — falls back silently if not
      // accessible (e.g. commercial role without admin reach).
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${assigned.user_id}&select=email`,
          { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}` }, cache: 'no-store' },
        )
        if (res.ok) {
          const arr = await res.json()
          if (Array.isArray(arr) && arr[0]?.email) assigned.email = arr[0].email
        }
      } catch { /* ignore — email is decorative */ }
    }

    return NextResponse.json({
      rdv,
      assigned,
      warning: pickedUserId
        ? null
        : 'Aucun commercial actif. Le RDV doit être assigné manuellement.',
    })
  } catch (err) {
    return errorResponse(err)
  }
}
