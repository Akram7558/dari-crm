// ─────────────────────────────────────────────────────────────────────
// GET /api/saas-distribution/preview
// ─────────────────────────────────────────────────────────────────────
// Calls saas_pick_next_commercial() to show the UI which commercial
// would be assigned the next SaaS RDV. Returns null fields when no
// active commercial is configured yet.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireInternalUser, ApiError, errorResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireInternalUser(req)
    if (ctx.role !== 'super_admin' && ctx.role !== 'commercial') {
      throw new ApiError(403, 'Accès refusé.')
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: 'Service role key missing.' }, { status: 500 })
    }
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    const { data: pickedId, error: pErr } = await admin.rpc('saas_pick_next_commercial')
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

    if (!pickedId) {
      return NextResponse.json({ user_id: null, email: null, percentage: null })
    }

    // Fetch the entry's percentage + email.
    const [{ data: entry }, listed] = await Promise.all([
      admin.from('saas_rdv_distribution').select('percentage').eq('user_id', pickedId).maybeSingle(),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ])
    let email: string | null = null
    if (!listed.error) {
      const found = listed.data.users.find(u => u.id === pickedId)
      email = found?.email ?? null
    }

    return NextResponse.json({
      user_id:    pickedId as string,
      email,
      percentage: entry ? Number(entry.percentage) : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
