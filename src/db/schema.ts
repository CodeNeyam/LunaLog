// file: src/db/schema.ts
export const schemaSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users(
  user_id TEXT PRIMARY KEY,
  join_date TEXT,
  chosen_vibe TEXT,
  inferred_vibe TEXT,

  -- LAST / LATEST activity snapshots (for /journey)
  last_message_at TEXT,
  last_message_channel_id TEXT,

  last_vc_at TEXT,
  last_vc_channel_id TEXT,
  last_vc_minutes INTEGER,

  last_connection_at TEXT,
  last_connection_user_id TEXT,
  last_connection_via TEXT, -- 'reply' | 'mention' | 'vc'

  last_seen_at TEXT,
  last_seen_type TEXT,      -- 'message' | 'voice' | 'connection' | 'command'
  last_seen_channel_id TEXT,

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

-- ✅ NEW: scoped daily stats (per category)
CREATE TABLE IF NOT EXISTS activity_scoped_daily(
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  category_id TEXT NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  voice_minutes INTEGER NOT NULL DEFAULT 0,
  bucket_night INTEGER NOT NULL DEFAULT 0,
  bucket_morning INTEGER NOT NULL DEFAULT 0,
  bucket_afternoon INTEGER NOT NULL DEFAULT 0,
  bucket_evening INTEGER NOT NULL DEFAULT 0,
  weekend_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, date, category_id)
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

-- NEW: channel ownership (for anti-farming in /top voice/chat)
CREATE TABLE IF NOT EXISTS created_channels(
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  channel_type TEXT,
  created_at TEXT NOT NULL
);

-- NEW: idempotent weekly recap runs (avoid duplicates after restart)
CREATE TABLE IF NOT EXISTS recap_runs(
  week_start TEXT PRIMARY KEY,
  posted_at TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_moments_user_created ON moments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_daily(user_id, date);

-- ✅ scoped indexes
CREATE INDEX IF NOT EXISTS idx_activity_scoped_user_date ON activity_scoped_daily(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_scoped_category_date ON activity_scoped_daily(category_id, date);

CREATE INDEX IF NOT EXISTS idx_created_channels_creator ON created_channels(creator_user_id);
`;
