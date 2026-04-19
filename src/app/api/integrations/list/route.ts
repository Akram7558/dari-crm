import { NextResponse } from 'next/server'
import { supaServer } from '@/lib/integrations-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/integrations/list?showroom_id=…
export async function GET(req: Request) {
  const url = new URL(req.url)
  const showroomId = url.searchParams.get('showroom_id')
  if (!showroomId) {
    return NextResponse.json({ error: 'showroom_id required' }, { status: 400 })
  }

  const sb = supaServer()
  const { data, error } = await sb
    .from('integrations')
    .select('id, showroom_id, provider, account_name, account_id, phone_number, expires_at, is_active, connected_at')
    .eq('showroom_id', showroomId)
    .order('connected_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, integrations: data ?? [] })
}
