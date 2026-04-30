-- ─────────────────────────────────────────────────────────────────────
-- Multi-tenant RLS isolation
-- ─────────────────────────────────────────────────────────────────────
-- Wipes test data, ensures every tenant table carries showroom_id, and
-- enables RLS so a non-super-admin user only sees rows belonging to
-- their own showroom.
--
-- Run in Supabase SQL Editor with the postgres role. Idempotent.
-- ─────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════
-- PART 1 — WIPE TEST DATA  (no real showrooms exist yet)
-- ═════════════════════════════════════════════════════════════════════

truncate table activities         cascade;
truncate table notifications      cascade;
truncate table ventes             cascade;
truncate table lead_distribution  cascade;
truncate table leads              cascade;
truncate table vehicles           cascade;

-- Keep super_admin user_role rows; clear everything else then drop showrooms.
delete from user_roles where role <> 'super_admin';
delete from showrooms;


-- ═════════════════════════════════════════════════════════════════════
-- PART 2 — ENSURE showroom_id COLUMN EXISTS ON ALL TENANT TABLES
-- ═════════════════════════════════════════════════════════════════════

alter table vehicles
  add column if not exists showroom_id uuid references showrooms(id) on delete cascade;

alter table ventes
  add column if not exists showroom_id uuid references showrooms(id) on delete cascade;

alter table activities
  add column if not exists showroom_id uuid references showrooms(id) on delete cascade;

alter table notifications
  add column if not exists showroom_id uuid references showrooms(id) on delete cascade;

-- After the truncate above, every tenant table is empty, so SET NOT NULL
-- is safe for all of them.
alter table leads          alter column showroom_id set not null;
alter table vehicles       alter column showroom_id set not null;
alter table ventes         alter column showroom_id set not null;
alter table activities     alter column showroom_id set not null;
alter table notifications  alter column showroom_id set not null;

create index if not exists idx_leads_showroom         on leads(showroom_id);
create index if not exists idx_vehicles_showroom      on vehicles(showroom_id);
create index if not exists idx_ventes_showroom        on ventes(showroom_id);
create index if not exists idx_activities_showroom    on activities(showroom_id);
create index if not exists idx_notifications_showroom on notifications(showroom_id);


-- ═════════════════════════════════════════════════════════════════════
-- PART 3 — HELPER FUNCTIONS  (SECURITY DEFINER bypasses RLS)
-- ═════════════════════════════════════════════════════════════════════

-- Returns the showroom_id of the currently authenticated user, or null
-- when the user has no role row (e.g. super_admin or unprovisioned).
create or replace function public.user_showroom_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select showroom_id
    from public.user_roles
   where user_id = auth.uid()
   limit 1;
$$;

-- Re-create is_super_admin() with the same definition as migration 13
-- in case this migration is run on a database that hasn't seen 13 yet.
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

revoke all on function public.user_showroom_id() from public;
revoke all on function public.is_super_admin()   from public;
grant execute on function public.user_showroom_id() to authenticated;
grant execute on function public.is_super_admin()   to authenticated;


-- ═════════════════════════════════════════════════════════════════════
-- PART 4 — ENABLE RLS + POLICIES ON TENANT TABLES
-- ═════════════════════════════════════════════════════════════════════

-- ── leads ───────────────────────────────────────────────────────────
alter table leads enable row level security;
drop policy if exists "tenant_all" on leads;
create policy "tenant_all" on leads for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── vehicles ────────────────────────────────────────────────────────
alter table vehicles enable row level security;
drop policy if exists "tenant_all" on vehicles;
create policy "tenant_all" on vehicles for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── ventes ──────────────────────────────────────────────────────────
alter table ventes enable row level security;
drop policy if exists "tenant_all" on ventes;
create policy "tenant_all" on ventes for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── activities ──────────────────────────────────────────────────────
alter table activities enable row level security;
drop policy if exists "tenant_all" on activities;
create policy "tenant_all" on activities for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── notifications ───────────────────────────────────────────────────
alter table notifications enable row level security;
drop policy if exists "tenant_all" on notifications;
create policy "tenant_all" on notifications for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── lead_distribution ───────────────────────────────────────────────
alter table lead_distribution enable row level security;
drop policy if exists "tenant_all" on lead_distribution;
create policy "tenant_all" on lead_distribution for all
  to authenticated
  using      (public.is_super_admin() or showroom_id = public.user_showroom_id())
  with check (public.is_super_admin() or showroom_id = public.user_showroom_id());

-- ── showrooms (the tenant table itself) ─────────────────────────────
alter table showrooms enable row level security;

drop policy if exists "showroom_select"        on showrooms;
drop policy if exists "showroom_admin_write"   on showrooms;
drop policy if exists "showroom_admin_update"  on showrooms;
drop policy if exists "showroom_admin_delete"  on showrooms;

-- A user can see their own showroom row; super_admin sees all.
create policy "showroom_select" on showrooms for select
  to authenticated
  using (public.is_super_admin() or id = public.user_showroom_id());

-- Only super_admin may insert / update / delete a showroom.
create policy "showroom_admin_write" on showrooms for insert
  to authenticated
  with check (public.is_super_admin());

create policy "showroom_admin_update" on showrooms for update
  to authenticated
  using      (public.is_super_admin())
  with check (public.is_super_admin());

create policy "showroom_admin_delete" on showrooms for delete
  to authenticated
  using (public.is_super_admin());
