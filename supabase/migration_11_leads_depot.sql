-- Deposit amount paid by a lead when their RDV is marked "Réservé".
-- Stored in DZD as a bigint (no fractional currency in DZ practice).
alter table leads add column if not exists depot_amount bigint;
