// ─────────────────────────────────────────────────────────────────────
// DELETE /api/saas-distribution/[user_id]
// ─────────────────────────────────────────────────────────────────────
// Removes a commercial from the auto-distribution table. Future RDVs
// will not be auto-assigned to them. Existing RDVs are untouched.
// super_admin only.
// ─────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin, errorResponse } from '@/lib/api-auth'

export const runtime = 'nodejs'

type RouteCtx = { params: Promise<{ user_id: string }> }

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  try {
    await requireSuperAdmin(req)
    const { user_id } = await params
    if (!user_id) return NextResponse.json({ error: 'user_id requis.' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: 'Service role key missing.' }, { status: 500 })
    }
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    const { error } = await admin
      .from('saas_rdv_distribution')
      .delete()
      .eq('user_id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
