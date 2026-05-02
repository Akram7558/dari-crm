-- ─────────────────────────────────────────────────────────────────────
-- SaaS prospect auto-distribution
-- ─────────────────────────────────────────────────────────────────────
-- Mirrors saas_rdv_distribution but for SaaS prospects: routes new
-- super_admin_prospects rows to the prospecteur_saas user most in
-- deficit vs their target share. Tie-break on oldest last_assigned_at.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. Table ────────────────────────────────────────────────────────
create table if not exists saas_prospect_distribution (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references auth.users(id) on delete cascade,
  percentage        numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  active            boolean not null default true,
  last_assigned_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_spd_active_pct on saas_prospect_distribution(active, percentage desc);


-- ── 2. RLS ──────────────────────────────────────────────────────────
alter table saas_prospect_distribution enable row level security;

drop policy if exists "spd_select" on saas_prospect_distribution;
drop policy if exists "spd_insert" on saas_prospect_distribution;
drop policy if exists "spd_update" on saas_prospect_distribution;
drop policy if exists "spd_delete" on saas_prospect_distribution;

-- All 3 internal roles can read (prospecteur_saas needs read access so
-- their own settings / preview surfaces work).
create policy "spd_select" on saas_prospect_distribution for select
  to authenticated
  using (public.is_internal_team());

-- Only super_admin writes.
create policy "spd_insert" on saas_prospect_distribution for insert
  to authenticated
  with check (public.is_super_admin());

create policy "spd_update" on saas_prospect_distribution for update
  to authenticated
  using      (public.is_super_admin())
  with check (public.is_super_admin());

create policy "spd_delete" on saas_prospect_distribution for delete
  to authenticated
  using (public.is_super_admin());


-- ── 3. Validate user_id is a prospecteur_saas ──────────────────────
create or replace function public.saas_validate_prospect_distribution_user()
returns trigger language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = new.user_id
       and role = 'prospecteur_saas'
  ) then
    raise exception 'Only users with role=prospecteur_saas can have a prospect distribution entry.';
  end if;
  return new;
end$$;

drop trigger if exists saas_validate_prospect_distribution_user_trigger on saas_prospect_distribution;
create trigger saas_validate_prospect_distribution_user_trigger
  before insert or update of user_id on saas_prospect_distribution
  for each row execute function public.saas_validate_prospect_distribution_user();


-- ── 4. Touch updated_at ────────────────────────────────────────────
create or replace function public.saas_touch_prospect_distribution_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists saas_touch_prospect_distribution_updated_at_trigger on saas_prospect_distribution;
create trigger saas_touch_prospect_distribution_updated_at_trigger
  before update on saas_prospect_distribution
  for each row execute function public.saas_touch_prospect_distribution_updated_at();


-- ── 5. Pick next prospecteur (deficit-driven) ──────────────────────
create or replace function public.saas_pick_next_prospecteur()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  picked_user     uuid;
  total_prospects int;
begin
  select count(*) into total_prospects from super_admin_prospects;

  select d.user_id into picked_user
    from saas_prospect_distribution d
    left join (
      select assigned_to, count(*) as prospect_count
        from super_admin_prospects
       where assigned_to is not null
       group by assigned_to
    ) p on p.assigned_to = d.user_id
   where d.active = true
     and d.percentage > 0
   order by
     (total_prospects * d.percentage / 100.0 - coalesce(p.prospect_count, 0)) desc,
     d.last_assigned_at asc nulls first
   limit 1;

  return picked_user;
end$$;

revoke all on function public.saas_pick_next_prospecteur() from public;
grant execute on function public.saas_pick_next_prospecteur() to authenticated;


-- ── 6. Touch last_assigned_at when a prospect is created ───────────
create or replace function public.saas_touch_prospect_distribution()
returns trigger language plpgsql security definer as $$
begin
  if new.assigned_to is not null then
    update saas_prospect_distribution
       set last_assigned_at = now()
     where user_id = new.assigned_to;
  end if;
  return new;
end$$;

drop trigger if exists saas_touch_prospect_distribution_trigger on super_admin_prospects;
create trigger saas_touch_prospect_distribution_trigger
  after insert on super_admin_prospects
  for each row execute function public.saas_touch_prospect_distribution();
