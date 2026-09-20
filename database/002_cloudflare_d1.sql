-- Artiling Jobs Phase 2 — Cloudflare D1 shared data store
-- Records keep the existing typed frontend model intact while the backend is
-- introduced. The collection allow-list is also enforced in application code.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS records_collection_updated_idx
  ON records (collection, updated_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  data TEXT NOT NULL CHECK (json_valid(data)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human', 'bot', 'system')),
  action TEXT NOT NULL,
  collection TEXT,
  record_id TEXT,
  old_value_json TEXT CHECK (old_value_json IS NULL OR json_valid(old_value_json)),
  new_value_json TEXT CHECK (new_value_json IS NULL OR json_valid(new_value_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_record_idx
  ON activity_log (collection, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_created_idx
  ON activity_log (created_at DESC);
