-- ─────────────────────────────────────────────────────────────────────
-- Showroom fixes — ventes RLS isolation + vehicles.motorisation
-- ─────────────────────────────────────────────────────────────────────
-- 1. Re-asserts strict per-tenant isolation on `ventes`. Drops the
--    bundled `tenant_all` policy from migration 14 and replaces it
--    with explicit per-action policies, so SELECT vs. write paths
--    can be reasoned about independently. Each policy checks against
--    `public.user_showroom_id()` for tenants and bypasses for
--    super_admin (and for SELECT, also commercial).
--
-- 2. Adds the optional `motorisation` text column on `vehicles` so
--    showrooms can record the engine designation (e.g. "1.0 TCe",
--    "1.5 TSi", "2.0 TDi").
--
-- Idempotent — drop policy if exists, add column if not exists.
-- ─────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════
-- PART 1 — Ventes RLS hardening
-- ═════════════════════════════════════════════════════════════════════

-- Defensive: ensure RLS is on. Migration 14 enabled it but a manual
-- DDL change could have toggled it off — flip it back on regardless.
alter table ventes enable row level security;

-- Drop the omnibus policy from migration 14, plus any earlier or
-- mistaken variants we might have left around.
drop policy if exists "tenant_all"             on ventes;
drop policy if exists "ventes_tenant_select"   on ventes;
drop policy if exists "ventes_tenant_insert"   on ventes;
drop policy if exists "ventes_tenant_update"   on ventes;
drop policy if exists "ventes_tenant_delete"   on ventes;

-- ── SELECT ───────────────────────────────────────────────────────────
-- Tenants see ONLY their own showroom's rows. super_admin sees
-- everything (cross-showroom oversight). commercial (AutoDex internal
-- sales rep — not the closer role) ALSO sees everything; they need
-- read-only access to monitor showroom activity but never see prices
-- in the UI (UI-layer financial gate).
create policy "ventes_tenant_select" on ventes
for select to authenticated
using (
  public.is_super_admin()
  or public.is_commercial()
  or showroom_id = public.user_showroom_id()
);

-- ── INSERT ───────────────────────────────────────────────────────────
-- Writers must stamp their own showroom_id. super_admin is allowed to
-- stamp any showroom_id (cross-tenant administration). commercial is
-- intentionally NOT allowed to write — they are read-only on ventes.
create policy "ventes_tenant_insert" on ventes
for insert to authenticated
with check (
  public.is_super_admin()
  or showroom_id = public.user_showroom_id()
);

-- ── UPDATE ───────────────────────────────────────────────────────────
-- Mutate own rows only (super_admin bypasses).
create policy "ventes_tenant_update" on ventes
for update to authenticated
using (
  public.is_super_admin()
  or showroom_id = public.user_showroom_id()
)
with check (
  public.is_super_admin()
  or showroom_id = public.user_showroom_id()
);

-- ── DELETE ───────────────────────────────────────────────────────────
create policy "ventes_tenant_delete" on ventes
for delete to authenticated
using (
  public.is_super_admin()
  or showroom_id = public.user_showroom_id()
);


-- ═════════════════════════════════════════════════════════════════════
-- PART 2 — vehicles.motorisation
-- ═════════════════════════════════════════════════════════════════════

-- Free-form text. Examples: "1.0 TCe", "1.5 TSi", "2.0 TDi". Optional.
alter table vehicles
  add column if not exists motorisation text;
