// file: src/db/schema.ts
export const schemaSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users(
  user_id TEXT PRIMARY KEY,
  join_date TEXT,
  chosen_vibe TEXT,
  inferred_vibe TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_daily(
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  voice_minutes INTEGER NOT NULL DEFAULT 0,
  bucket_night INTEGER NOT NULL DEFAULT 0,
  bucket_morning INTEGER NOT NULL DEFAULT 0,
  bucket_afternoon INTEGER NOT NULL DEFAULT 0,
  bucket_evening INTEGER NOT NULL DEFAULT 0,
  weekend_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, date)
);

CREATE TABLE IF NOT EXISTS interactions(
  user_id TEXT NOT NULL,
  other_user_id TEXT NOT NULL,
  mentions INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  vc_minutes_together INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TEXT,
  PRIMARY KEY(user_id, other_user_id)
);

CREATE TABLE IF NOT EXISTS moments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moments_user_created ON moments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_daily(user_id, date);
`;
