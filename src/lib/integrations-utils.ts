import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function supaServer(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export const ALLOWED_PROVIDERS = ['whatsapp', 'messenger', 'instagram'] as const
export type AllowedProvider = (typeof ALLOWED_PROVIDERS)[number]

export function isAllowedProvider(v: unknown): v is AllowedProvider {
  return typeof v === 'string' && (ALLOWED_PROVIDERS as readonly string[]).includes(v)
}
