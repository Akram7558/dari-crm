import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// Meta OAuth callback — STUB
//
// Once the Meta app is approved, this route will:
//   1. Read `code` + `state` from the query string
//   2. Exchange the code for a long-lived access token
//   3. Look up the WhatsApp Business Account ID / Page ID
//   4. Upsert an `integrations` row keyed on (showroom_id, provider)
//   5. Redirect back to /dashboard/settings/integrations
//
// For now it just echoes what it received so the Meta app review
// can resolve a valid URL.
// ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorReason = url.searchParams.get('error_reason')

  if (error) {
    const redirect = new URL('/dashboard/settings/integrations', url.origin)
    redirect.searchParams.set('oauth_error', errorReason || error)
    return NextResponse.redirect(redirect.toString())
  }

  // Real flow would exchange `code` for a token here.
  // For the mock flow we just redirect home.
  const redirect = new URL('/dashboard/settings/integrations', url.origin)
  if (code) redirect.searchParams.set('oauth_pending', '1')
  if (state) redirect.searchParams.set('state', state)
  return NextResponse.redirect(redirect.toString())
}
