-- ─────────────────────────────────────────────────────────────────────
-- SaaS RDV auto-distribution
-- ─────────────────────────────────────────────────────────────────────
-- Allocates incoming SaaS RDVs across active commercial users according
-- to configurable percentages. Picks the user most in deficit vs their
-- target share, breaking ties on oldest last_assigned_at.
--
-- Tables:    saas_rdv_distribution
-- Functions: saas_pick_next_commercial(), saas_validate_distribution_user(),
--            saas_touch_distribution_on_rdv()
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Distribution table ───────────────────────────────────────────
create table if not exists saas_rdv_distribution (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  percentage        numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  active            boolean not null default true,
  last_assigned_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_srd_active_pct on saas_rdv_distribution(active, percentage desc);


-- ── 2. RLS ─────────────────────────────────────────────────────────
alter table saas_rdv_distribution enable row level security;

drop policy if exists "srd_select" on saas_rdv_distribution;
drop policy if exists "srd_insert" on saas_rdv_distribution;
drop policy if exists "srd_update" on saas_rdv_distribution;
drop policy if exists "srd_delete" on saas_rdv_distribution;

-- super_admin + commercial can read.
create policy "srd_select" on saas_rdv_distribution for select
  to authenticated
  using (public.is_super_admin() or public.is_commercial());

-- Only super_admin writes.
create policy "srd_insert" on saas_rdv_distribution for insert
  to authenticated
  with check (public.is_super_admin());

create policy "srd_update" on saas_rdv_distribution for update
  to authenticated
  using      (public.is_super_admin())
  with check (public.is_super_admin());

create policy "srd_delete" on saas_rdv_distribution for delete
  to authenticated
  using (public.is_super_admin());


-- ── 3. Validate user_id is a commercial ─────────────────────────────
create or replace function public.saas_validate_distribution_user()
returns trigger language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = new.user_id
       and role = 'commercial'
  ) then
    raise exception 'Only users with role=commercial can have a distribution entry.';
  end if;
  return new;
end$$;

drop trigger if exists saas_validate_distribution_user_trigger on saas_rdv_distribution;
create trigger saas_validate_distribution_user_trigger
  before insert or update of user_id on saas_rdv_distribution
  for each row execute function public.saas_validate_distribution_user();


-- ── 4. Touch updated_at ─────────────────────────────────────────────
create or replace function public.saas_touch_distribution_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists saas_touch_distribution_updated_at_trigger on saas_rdv_distribution;
create trigger saas_touch_distribution_updated_at_trigger
  before update on saas_rdv_distribution
  for each row execute function public.saas_touch_distribution_updated_at();


-- ── 5. Pick next commercial (deficit-driven) ────────────────────────
-- Returns the active commercial whose actual share is furthest below
-- their target share. Ties break on oldest last_assigned_at (NULL first
-- so users who've never received a RDV come up before anyone else).
create or replace function public.saas_pick_next_commercial()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  picked_user uuid;
  total_rdvs  int;
begin
  select count(*) into total_rdvs from super_admin_rdv;

  select d.user_id into picked_user
    from saas_rdv_distribution d
    left join (
      select assigned_to, count(*) as rdv_count
        from super_admin_rdv
       where assigned_to is not null
       group by assigned_to
    ) r on r.assigned_to = d.user_id
   where d.active = true
     and d.percentage > 0
   order by
     (total_rdvs * d.percentage / 100.0 - coalesce(r.rdv_count, 0)) desc,
     d.last_assigned_at asc nulls first
   limit 1;

  return picked_user;
end$$;

revoke all on function public.saas_pick_next_commercial() from public;
grant execute on function public.saas_pick_next_commercial() to authenticated;


-- ── 6. Touch last_assigned_at when a RDV is created ─────────────────
create or replace function public.saas_touch_distribution_on_rdv()
returns trigger language plpgsql security definer as $$
begin
  if new.assigned_to is not null then
    update saas_rdv_distribution
       set last_assigned_at = now()
     where user_id = new.assigned_to;
  end if;
  return new;
end$$;

drop trigger if exists saas_touch_distribution_on_rdv_trigger on super_admin_rdv;
create trigger saas_touch_distribution_on_rdv_trigger
  after insert on super_admin_rdv
  for each row execute function public.saas_touch_distribution_on_rdv();
