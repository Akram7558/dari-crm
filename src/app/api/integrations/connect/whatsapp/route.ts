import { NextResponse } from 'next/server'
import { supaServer, isAllowedProvider } from '@/lib/integrations-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Mock OAuth — until the Meta app is reviewed/approved.
//
// POST body:
//   {
//     showroom_id: string,
//     provider?: 'whatsapp' | 'messenger' | 'instagram',  // default 'whatsapp'
//     phone_number: string,
//     account_name: string,
//     account_id?: string,
//   }
//
// Upserts an `integrations` row (unique on showroom_id + provider)
// and marks it as active.
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* ignore */ }

  const showroomId   = typeof body.showroom_id   === 'string' ? body.showroom_id   : null
  const providerRaw  = typeof body.provider      === 'string' ? body.provider      : 'whatsapp'
  const phoneNumber  = typeof body.phone_number  === 'string' ? body.phone_number.trim()  : ''
  const accountName  = typeof body.account_name  === 'string' ? body.account_name.trim()  : ''
  const accountId    = typeof body.account_id    === 'string' ? body.account_id.trim()    : null

  if (!showroomId) return NextResponse.json({ error: 'showroom_id required' }, { status: 400 })
  if (!isAllowedProvider(providerRaw)) {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }
  if (!accountName) return NextResponse.json({ error: 'account_name required' }, { status: 400 })
  if (providerRaw === 'whatsapp' && !phoneNumber) {
    return NextResponse.json({ error: 'phone_number required for whatsapp' }, { status: 400 })
  }

  const sb = supaServer()

  const { data, error } = await sb
    .from('integrations')
    .upsert(
      [{
        showroom_id:   showroomId,
        provider:      providerRaw,
        account_name:  accountName,
        account_id:    accountId,
        phone_number:  providerRaw === 'whatsapp' ? phoneNumber : (phoneNumber || null),
        access_token:  null,      // real token set once Meta OAuth is live
        expires_at:    null,
        is_active:     true,
        connected_at:  new Date().toISOString(),
      }],
      { onConflict: 'showroom_id,provider' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, integration: data })
}

// Placeholder for the real OAuth redirect — kept as a GET so the
// frontend can eventually `window.location = /api/integrations/connect/whatsapp`.
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'real OAuth flow not yet implemented; use the mock modal (POST).',
  }, { status: 501 })
}
