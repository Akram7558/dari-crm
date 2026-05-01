# Pre-release Security Audit Checklist

> Run this audit before every release that touches API routes, RLS
> policies, auth flow, webhooks, or env vars.
>
> **Last full audit:** 2026-05-01

This checklist exists because RLS at the database layer does not, on
its own, prevent cross-tenant leaks. Service-role API routes bypass
RLS, and any route that uses the service-role key must enforce its
own auth + showroom-membership checks. Likewise, signed webhooks and
session middleware must be re-validated whenever they're touched.

When something on this list fails, fix it before the release ships —
do not skip a box without writing down the rationale next to it.

---

## 1. Service-role API routes

The service-role Supabase client bypasses RLS. Every route that
reaches for it must authenticate the caller in app code.

- [ ] List every file under `src/app/api/**` that imports
      `SUPABASE_SERVICE_ROLE_KEY`, calls `supaServer()`, or
      otherwise constructs a service-role Supabase client. Quick
      pass:

      ```bash
      grep -RnE "SUPABASE_SERVICE_ROLE_KEY|supaServer\(|createServiceRoleClient" \
        src/app/api src/lib
      ```

- [ ] For each such route, confirm the handler calls
      `requireUser()` or `requireShowroomMember()` from
      `src/lib/api-auth.ts` **before any DB operation**. The only
      exception today is the Meta webhook routes, which authenticate
      via HMAC signature instead — see section 4.

- [ ] Verify `showroom_id` is derived server-side from
      `public.user_roles` (via the `ShowroomContext.showroomId`
      returned by `requireShowroomMember()`). Request body / query
      string / header values for `showroom_id` are at most a
      cross-check, never the source of truth.

- [ ] For each route that allows a super_admin override (i.e.
      a non-null `requestedShowroomId` is honored when
      `isSuperAdmin === true`), confirm the override is intentional
      and documented in the route's comment header.

- [ ] Confirm the same auth pattern is applied to any new
      service-role utility added since the last audit.

## 2. RLS coverage

- [ ] In Supabase SQL Editor, run:

      ```sql
      select tablename, rowsecurity
        from pg_tables
       where schemaname = 'public'
       order by tablename;
      ```

      Verify `rowsecurity = true` for every tenant-scoped table:
      `activities`, `lead_distribution`, `leads`, `notifications`,
      `showrooms`, `user_roles`, `vehicles`, `ventes`.

- [ ] In the Table Editor, confirm none of those tables show the
      red **UNRESTRICTED** badge. RLS-enabled tables show the
      "1 RLS policy" indicator (or more) in the table toolbar.

- [ ] Confirm each tenant table has the `tenant_all` policy with
      the expected predicate
      `(public.is_super_admin() or showroom_id = public.user_showroom_id())`:

      ```sql
      select tablename, policyname, cmd, qual, with_check
        from pg_policies
       where schemaname = 'public'
       order by tablename, policyname;
      ```

- [ ] Confirm `public.is_super_admin()` and
      `public.user_showroom_id()` are still `security definer` and
      granted to `authenticated`:

      ```sql
      select p.proname, p.prosecdef as security_definer
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('is_super_admin', 'user_showroom_id');
      ```

## 3. Secret hygiene

- [ ] Confirm `.env.local` and friends are in `.gitignore`:

      ```bash
      grep -E "^\.env" .gitignore
      ```

      Expected: a line matching `.env*` (or explicit
      `.env.local`, `.env.development.local`, etc.).

- [ ] Run a recent-secret-pattern scan against the entire history.
      Replace `<pattern>` with whatever value/prefix you suspect:

      ```bash
      git log --all -p -S "<pattern>" | head -200
      ```

      For a fast sweep of common shapes:

      ```bash
      git log --all -p | grep -nE \
        "(re_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{16,}|xox[abp]-[A-Za-z0-9-]+|hooks\.slack\.com/[A-Za-z0-9/]+|postgres://[^[:space:]]+)" \
        | head -40
      ```

      Empty output = clean. If anything matches, capture the commit
      hash and rotate the secret immediately, then evaluate whether
      to rewrite history.

- [ ] Confirm Vercel env vars are present and correctly classified.
      In `Project → Settings → Environment Variables`:

      | Variable                     | Sensitive | Environments |
      |------------------------------|-----------|--------------|
      | `SUPABASE_SERVICE_ROLE_KEY`  | yes       | Production, Preview |
      | `RESEND_API_KEY`             | yes       | Production, Preview, Development |
      | `META_APP_SECRET`            | yes       | Production, Preview |
      | `WHATSAPP_ACCESS_TOKEN`      | yes       | Production, Preview |
      | `ANTHROPIC_API_KEY`          | yes (if used) | Production, Preview, Development |
      | `TEST_WEBHOOK_TOKEN`         | yes       | **UNSET in Production** (set only in Preview when needed) |

      Sensitive variables cannot be added to the Development
      environment in Vercel; flip the Sensitive toggle off and
      include Development only when the value is genuinely
      non-secret (e.g. `RESEND_FROM` mailbox).

## 4. Webhook security

- [ ] In each of the three Meta webhook routes
      (`src/app/api/webhooks/{whatsapp,messenger,instagram}/route.ts`)
      confirm the POST handler:

      1. Reads the raw request body via `await req.text()`.
      2. Calls `verifyMetaSignature(raw, sig)` and returns 401 on
         failure unless test mode is active.
      3. Test mode is gated entirely by an env var (currently
         `process.env.TEST_WEBHOOK_TOKEN`). There is no hardcoded
         magic string. Search for any hardcoded comparison:

         ```bash
         grep -nE "x-test-mode.*===.*['\"][a-z0-9-]{6,}" src/app/api/webhooks
         ```

         Expected: empty output.

- [ ] Confirm the GET handler still reads the verify token from
      `process.env.WHATSAPP_VERIFY_TOKEN` (or the platform's
      equivalent). The token must not be a literal string in code.

- [ ] If `TEST_WEBHOOK_TOKEN` was set in Preview for a debugging
      session, **rotate it after the session and clear it from
      Preview** so a leftover token cannot be reused.

## 5. Auth & middleware

- [ ] Confirm `/dashboard/*` routes are gated by
      `src/middleware.ts` (or equivalent). The middleware should
      redirect unauthenticated requests to the login page before
      any page renders.

- [ ] Confirm the middleware uses `@supabase/ssr`
      (`createServerClient`), not the deprecated
      `@supabase/auth-helpers-nextjs`. Check:

      ```bash
      grep -RnE "@supabase/(ssr|auth-helpers-nextjs)" src
      ```

      Expected: only `@supabase/ssr` results.

- [ ] Confirm role-based route gating:

      - `/dashboard/super-admin/*` → must check
        `user_roles.role === 'super_admin'` server-side, either in
        `middleware.ts` or in the page's RSC.
      - Owner-only routes (e.g. showroom settings) → must check
        `role in ('owner', 'super_admin')`.
      - Agent-only routes → similar membership check.

      Cross-reference any `super-admin`, `owner`, or `agent`
      directories under `src/app/dashboard/`:

      ```bash
      ls src/app/dashboard
      grep -RnE "user_roles|role\s*===\s*['\"](super_admin|owner|agent)" \
        src/app/dashboard src/middleware.ts 2>/dev/null
      ```

## 6. Cross-tenant verification curls

Run these against the deployed environment after each release.
None should succeed.

- [ ] Anonymous request to disconnect → expect **401** with
      `{"error":"Non authentifié."}`:

      ```bash
      curl -sS -i -X POST https://www.autodex.store/api/integrations/disconnect \
        -H 'Content-Type: application/json' \
        -d '{"showroom_id":"00000000-0000-0000-0000-000000000000","provider":"whatsapp"}' \
        | head -5
      ```

- [ ] Anonymous request to list integrations → expect **401**:

      ```bash
      curl -sS -i 'https://www.autodex.store/api/integrations/list?showroom_id=00000000-0000-0000-0000-000000000000' \
        | head -5
      ```

- [ ] Anonymous request to check-alerts → expect **401**:

      ```bash
      curl -sS -i -X POST https://www.autodex.store/api/check-alerts \
        -H 'Content-Type: application/json' -d '{}' | head -5
      ```

- [ ] Old hardcoded backdoor against the WhatsApp webhook →
      expect **401 invalid signature**:

      ```bash
      curl -sS -i -X POST https://www.autodex.store/api/webhooks/whatsapp \
        -H 'x-test-mode: autodex-dev-2024' \
        -H 'Content-Type: application/json' \
        -d '{"object":"whatsapp_business_account","entry":[]}' \
        | head -5
      ```

- [ ] (Manual) Sign in to the dashboard as a tenant user, open the
      browser DevTools console, and run:

      ```js
      await fetch('/api/integrations/list?showroom_id=<another-showrooms-uuid>')
        .then(r => r.status)
      ```

      Expect **403** (`Accès interdit à ce showroom.`).

## 7. Dependency scan

- [ ] Run `npm audit` and review every high or critical
      vulnerability. Patch via `npm audit fix` when safe; otherwise
      open a tracking issue with the planned remediation.

- [ ] Confirm `@supabase/ssr` is up to date relative to current
      stable. The whole auth stack depends on it:

      ```bash
      npm ls @supabase/ssr @supabase/supabase-js
      npm view @supabase/ssr version
      ```

- [ ] Look for any pinned dependency at a version more than
      6 months behind upstream that handles secrets, auth, or
      cryptography (Supabase, jose, jsonwebtoken, crypto-js).

---

## Appendix — Threat model reminders

- **RLS does not protect data from service-role keys.** Any code
  path that uses `SUPABASE_SERVICE_ROLE_KEY` reads/writes through a
  superuser client; the database itself enforces nothing.
- **Public-by-design keys.** `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are intended to be exposed to the
  browser. Their security guarantee is purely RLS — never assume
  anonymous reads of a public table are safe just because the key
  is "private" in some other context.
- **Cookies, not headers.** All app-level auth flows through the
  Supabase auth cookie set by `@supabase/ssr`. Never authenticate
  an API call by reading a custom header that the client controls.
- **History is forever.** A secret pushed to git is compromised
  the moment the push completes, even if removed in the next
  commit. Rotation is mandatory; history rewrites are optional and
  rarely worth the cost on a public repo.
