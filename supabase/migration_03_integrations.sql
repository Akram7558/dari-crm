-- ============================================================
-- Migration 03 — Intégrations Meta (WhatsApp / Messenger / Instagram)
-- Exécutez ce fichier dans Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id    UUID NOT NULL REFERENCES showrooms(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL CHECK (provider IN ('whatsapp', 'messenger', 'instagram')),
  account_name   TEXT,
  account_id     TEXT,
  phone_number   TEXT,
  access_token   TEXT,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN DEFAULT TRUE,
  connected_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (showroom_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_showroom
  ON integrations (showroom_id, is_active);

CREATE INDEX IF NOT EXISTS idx_integrations_provider
  ON integrations (provider);

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations_select_all" ON integrations;
CREATE POLICY "integrations_select_all"
  ON integrations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "integrations_insert_all" ON integrations;
CREATE POLICY "integrations_insert_all"
  ON integrations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "integrations_update_all" ON integrations;
CREATE POLICY "integrations_update_all"
  ON integrations FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "integrations_delete_all" ON integrations;
CREATE POLICY "integrations_delete_all"
  ON integrations FOR DELETE
  USING (true);

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'integrations'
ORDER BY ordinal_position;
