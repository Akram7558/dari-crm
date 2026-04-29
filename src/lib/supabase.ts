import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client.
// IMPORTANT: this uses `createBrowserClient` from @supabase/ssr instead of
// the plain `createClient` from supabase-js so that the session is stored
// in **cookies** rather than localStorage. The Next.js middleware reads
// cookies — without this change, the middleware never saw the session and
// every dashboard request bounced back to the login page.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
