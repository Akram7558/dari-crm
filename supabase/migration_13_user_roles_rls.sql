-- ─────────────────────────────────────────────────────────────────────
-- Row-Level Security for user_roles
-- ─────────────────────────────────────────────────────────────────────
-- Lets every authenticated user read their own role row, and lets
-- super_admins read all rows (so the Super Admin dashboard can list users).
--
-- We avoid the infinite-recursion trap by introducing a SECURITY DEFINER
-- helper `is_super_admin()` that bypasses RLS when checking the caller's
-- role — referencing user_roles directly inside an RLS policy on
-- user_roles itself causes Postgres to throw
--   "infinite recursion detected in policy for relation user_roles".
-- ─────────────────────────────────────────────────────────────────────

-- ── Helper: am I a super_admin? ──────────────────────────────────────
-- SECURITY DEFINER runs the function with the privileges of its OWNER
-- (postgres / the migration runner), so the inner SELECT skips RLS and
-- answers honestly without triggering the policy on user_roles again.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.user_roles
     where user_id = auth.uid()
       and role = 'super_admin'
  );
$$;

-- Lock the function down: only authenticated users may call it.
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- ── Enable RLS + policies ────────────────────────────────────────────
alter table user_roles enable row level security;

-- Everyone may read their own role row.
drop policy if exists "user_roles read own" on user_roles;
create policy "user_roles read own"
on user_roles for select
to authenticated
using (auth.uid() = user_id);

-- Super admins may read every row.
drop policy if exists "user_roles read all for super_admin" on user_roles;
create policy "user_roles read all for super_admin"
on user_roles for select
to authenticated
using (public.is_super_admin());

-- Super admins may insert / update / delete any row (Super Admin
-- dashboard CRUD). Regular roles cannot write to user_roles directly.
drop policy if exists "user_roles write super_admin" on user_roles;
create policy "user_roles write super_admin"
on user_roles for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
