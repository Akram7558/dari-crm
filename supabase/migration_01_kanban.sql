-- ============================================================
-- Migration 01 — Champs Kanban
-- Exécutez ce fichier dans Supabase SQL Editor
-- ============================================================

-- 1. Nouveaux champs sur la table leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS model_wanted TEXT,
  ADD COLUMN IF NOT EXISTS budget_dzd   NUMERIC(14, 2);

-- 2. Mise à jour de la contrainte source pour inclure les réseaux sociaux détaillés
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'walk-in',
    'phone',
    'website',
    'referral',
    'social',
    'facebook',
    'instagram',
    'whatsapp',
    'telephone'
  ));

-- 3. Remplir model_wanted à partir des notes existantes (optionnel)
-- UPDATE leads SET model_wanted = notes WHERE model_wanted IS NULL;

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;
