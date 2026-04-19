import { NextResponse } from 'next/server'
import { isAllowedProvider, type AllowedProvider } from '@/lib/integrations-utils'
import { processIncomingMessage } from '@/lib/webhook-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/integrations/test
// Body: { provider: 'whatsapp' | 'messenger' | 'instagram' }
//
// Sends a synthetic message through the same pipeline that real
// webhooks use, so the showroom can see that a test lead shows up
// in their pipeline.
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* ignore */ }

  const provider = typeof body.provider === 'string' ? body.provider : 'whatsapp'
  if (!isAllowedProvider(provider)) {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }

  // 8-char suffix so retrying the test button makes a fresh lead.
  const tag = Math.random().toString(36).slice(2, 10).toUpperCase()
  const phone = `+21355${Math.floor(1_000_000 + Math.random() * 9_000_000)}`

  const sampleText: Record<AllowedProvider, string> = {
    whatsapp:  `Salam, je m'appelle Test ${tag}. Je cherche une Geely Coolray, budget 4500000 DA, je suis à Oran. Téléphone ${phone}`,
    messenger: `Bonjour, je suis Test ${tag}. Intéressé par Chery Tiggo 4, budget 5000000, Alger. Contactez-moi au ${phone}`,
    instagram: `Hello ! Test ${tag} — je veux infos sur Fiat 500X. Je suis à Constantine, budget 3500000. Tel: ${phone}`,
  }

  const platform: 'whatsapp' | 'facebook' | 'instagram' =
    provider === 'whatsapp' ? 'whatsapp'
    : provider === 'messenger' ? 'facebook'
    : 'instagram'

  const result = await processIncomingMessage({
    platform,
    messageText: sampleText[provider],
    senderName: `Test ${tag}`,
    platformPhone: provider === 'whatsapp' ? phone.replace('+', '') : null,
  })

  return NextResponse.json(result)
}
