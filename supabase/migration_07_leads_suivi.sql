-- Add follow-up tracking column to leads.
-- Distinct from "status" (sales pipeline stage); "suivi" tracks contact attempts.
alter table leads
  add column if not exists suivi text;

create index if not exists idx_leads_suivi on leads(suivi);
