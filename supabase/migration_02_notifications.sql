-- ============================================================
-- Migration 02 — Système d'alertes & notifications
-- Exécutez ce fichier dans Supabase SQL Editor
-- ============================================================

-- 1. Table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id  UUID REFERENCES showrooms(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN (
                 'lead_ignored',
                 'lead_stagnant',
                 'stock_rupture',
                 'vendor_inactive'
               )),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  lead_id      UUID REFERENCES leads(id) ON DELETE CASCADE,
  vehicle_id   UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  dedupe_key   TEXT UNIQUE,
  read         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_notif_unread_created
  ON notifications (read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_type
  ON notifications (type);

-- 3. RLS — lecture ouverte (anon key), mise à jour par user_id
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_all" ON notifications;
CREATE POLICY "notifications_select_all"
  ON notifications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "notifications_insert_all" ON notifications;
CREATE POLICY "notifications_insert_all"
  ON notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_all" ON notifications;
CREATE POLICY "notifications_update_all"
  ON notifications FOR UPDATE
  USING (true);

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;
