-- Add scheduled appointment timestamp to leads.
-- Used when suivi = 'rdv_planifie' to track when the client is coming.
alter table leads
  add column if not exists rdv_date timestamptz;

create index if not exists idx_leads_rdv_date on leads(rdv_date);
