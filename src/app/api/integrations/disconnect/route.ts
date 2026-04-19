import { NextResponse } from 'next/server'
import { supaServer, isAllowedProvider } from '@/lib/integrations-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST body (one of):
//   { id: string }
//   { showroom_id: string, provider: 'whatsapp' | 'messenger' | 'instagram' }
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* ignore */ }

  const sb = supaServer()
  const id         = typeof body.id === 'string' ? body.id : null
  const showroomId = typeof body.showroom_id === 'string' ? body.showroom_id : null
  const provider   = typeof body.provider === 'string' ? body.provider : null

  let query = sb.from('integrations').delete()
  if (id) {
    query = query.eq('id', id)
  } else if (showroomId && provider && isAllowedProvider(provider)) {
    query = query.eq('showroom_id', showroomId).eq('provider', provider)
  } else {
    return NextResponse.json({ error: 'id or (showroom_id + provider) required' }, { status: 400 })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
