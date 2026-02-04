// file: src/db/statements.ts
import type Database from "better-sqlite3";
import type { Logger } from "../utils/logger.js";

/** =========================
 *  Row Types
 *  ========================= */

export type UserRow = {
  user_id: string;
  join_date: string | null;
  chosen_vibe: string | null;
  inferred_vibe: string | null;

  last_message_at: string | null;
  last_message_channel_id: string | null;

  last_vc_at: string | null;
  last_vc_channel_id: string | null;
  last_vc_minutes: number | null;

  last_connection_at: string | null;
  last_connection_user_id: string | null;
  last_connection_via: string | null;

  last_seen_at: string | null;
  last_seen_type: string | null;
  last_seen_channel_id: string | null;

  created_at: string;
  updated_at: string;
};

export type UserVibeRow = {
  user_id: string;
  chosen_vibe: string | null;
  inferred_vibe: string | null;
};

export type MomentRow = {
  id: number;
  user_id: string;
  type: string;
  meta: string | null;
  created_at: string;
};

export type MomentListRow = {
  id: number;
  meta: string | null;
  created_at: string;
};

export type InteractionTopRow = {
  other_user_id: string;
  mentions: number;
  replies: number;
  vc_minutes_together: number;
  score: number;
  last_interaction_at: string | null;
};

export type InteractionPairRow = {
  user_id: string;
  other_user_id: string;
  mentions: number;
  replies: number;
  vc_minutes_together: number;
  last_interaction_at: string | null;
};

export type ActivityTotals = {
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
  weekend: number;
  messages: number;
  voice: number;
};

export type BucketKey = "night" | "morning" | "afternoon" | "evening";

export type ScopedTotals = {
  messages: number;
  voice: number;
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
  weekend: number;
};

export type ScopedLeaderboardRow = { user_id: string; value: number };

/** =========================
 *  Statements API
 *  ========================= */

export type Statements = {
  users: {
    upsertUser: (userId: string, joinIso: string | null) => void;
    setJoinDateIfNull: (userId: string, joinIso: string) => void;
    setChosenVibe: (userId: string, chosenJson: string) => void;
    setInferredVibe: (userId: string, inferredJson: string) => void;
    getUser: (userId: string) => UserRow | undefined;

    setLastMessage: (userId: string, atIso: string, channelId: string) => void;
    setLastVc: (userId: string, atIso: string, channelId: string, minutes: number) => void;
    setLastConnection: (
      userId: string,
      atIso: string,
      otherUserId: string,
      via: "reply" | "mention" | "vc"
    ) => void;
    setLastSeen: (
      userId: string,
      atIso: string,
      type: "message" | "voice" | "connection" | "command",
      channelId: string | null
    ) => void;

    listUsersVibes: () => UserVibeRow[];
  };

  activity: {
    addMessage: (userId: string, dateKey: string, bucket: BucketKey, weekendDelta: number) => void;
    addVoice: (
      userId: string,
      dateKey: string,
      minutes: number,
      bucketDeltas: Record<BucketKey, number>,
      weekendDelta: number
    ) => void;
    getTotals: (userId: string) => ActivityTotals;

    topMessages: (limit: number) => Array<{ user_id: string; value: number }>;
    topVoice: (limit: number) => Array<{ user_id: string; value: number }>;
    topNight: (limit: number) => Array<{ user_id: string; value: number }>;

    // NEW (weekly recap range queries)
    topMessagesBetween: (startDateKey: string, endDateKey: string, limit: number) => Array<{ user_id: string; value: number }>;
    topVoiceBetween: (startDateKey: string, endDateKey: string, limit: number) => Array<{ user_id: string; value: number }>;
    totalsBetween: (startDateKey: string, endDateKey: string) => { messages: number; voice: number };

    // ✅ NEW: scoped methods (ADDED ONLY)
    addMessageScoped: (userId: string, dateKey: string, categoryId: string, bucket: BucketKey, weekendDelta: number) => void;
    addVoiceScoped: (
      userId: string,
      dateKey: string,
      categoryId: string,
      minutes: number,
      bucketDeltas: Record<BucketKey, number>,
      weekendDelta: number
    ) => void;

    getTotalsScoped: (userId: string, categoryIds: string[]) => ScopedTotals;

    topMessagesScoped: (categoryIds: string[], limit: number) => ScopedLeaderboardRow[];
    topVoiceScoped: (categoryIds: string[], limit: number) => ScopedLeaderboardRow[];
    topNightScoped: (categoryIds: string[], limit: number) => ScopedLeaderboardRow[];

    topMessagesScopedBetween: (categoryIds: string[], startDateKey: string, endDateKey: string, limit: number) => ScopedLeaderboardRow[];
    topVoiceScopedBetween: (categoryIds: string[], startDateKey: string, endDateKey: string, limit: number) => ScopedLeaderboardRow[];
    totalsScopedBetween: (categoryIds: string[], startDateKey: string, endDateKey: string) => { messages: number; voice: number };
  };

  interactions: {
    addDelta: (args: {
      userId: string;
      otherUserId: string;
      mentionsDelta: number;
      repliesDelta: number;
      vcMinutesDelta: number;
      lastInteractionAtIso: string;
    }) => void;

    topMostSeenWith: (userId: string, limit: number) => InteractionTopRow[];
    getPair: (userId: string, otherUserId: string) => InteractionPairRow | undefined;
    topUsersByScore: (limit: number) => Array<{ user_id: string; value: number }>;

    // ✅ NEW: summary for /about (ADDED ONLY)
    getSummary: (userId: string) => { links: number; score: number };
  };

  moments: {
    insert: (userId: string, type: string, metaJson: string | null, createdAtIso: string) => void;
    getByType: (userId: string, type: string) => MomentRow | undefined;
    getEarliest: (userId: string) => MomentRow | undefined;

    listRecent: (userId: string, limit: number) => MomentListRow[];
    deleteByIdForUser: (id: number, userId: string) => boolean;

    // NEW (weekly recap)
    countNotesBetween: (startIso: string, endIso: string) => number;
    listRecentNotesBetween: (startIso: string, endIso: string, limit: number) => Array<{ user_id: string; meta: string | null; created_at: string }>;
  };

  // NEW: channel ownership tracking
  channels: {
    upsertCreatedChannel: (args: {
      channelId: string;
      guildId: string;
      creatorUserId: string;
      channelType: string;
      createdAtIso: string;
    }) => void;

    getCreatorUserId: (channelId: string) => string | undefined;
  };

  // NEW: recap run registry (idempotent)
  recap: {
    hasRun: (weekStartDateKey: string) => boolean;
    markRun: (args: {
      weekStartDateKey: string;
      postedAtIso: string;
      channelId: string;
      messageId: string | null;
    }) => void;
  };
};

/** =========================
 *  Build Statements
 *  ========================= */

export function buildStatements(db: Database.Database, logger: Logger): Statements {
  const nowIso = () => new Date().toISOString();

  // ---------------------------
  // Safe migration for new columns
  // ---------------------------
  function ensureUsersColumns(): void {
    try {
      const cols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
      const existing = new Set(cols.map((c) => c.name));

      const addCol = (name: string, sqlType: string) => {
        if (existing.has(name)) return;
        db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${sqlType}`).run();
      };

      addCol("last_message_at", "TEXT");
      addCol("last_message_channel_id", "TEXT");

      addCol("last_vc_at", "TEXT");
      addCol("last_vc_channel_id", "TEXT");
      addCol("last_vc_minutes", "INTEGER");

      addCol("last_connection_at", "TEXT");
      addCol("last_connection_user_id", "TEXT");
      addCol("last_connection_via", "TEXT");

      addCol("last_seen_at", "TEXT");
      addCol("last_seen_type", "TEXT");
      addCol("last_seen_channel_id", "TEXT");
    } catch (err) {
      logger.error("DB migration ensureUsersColumns failed", {
        err: err instanceof Error ? err.message : String(err)
      });
    }
  }

  ensureUsersColumns();

  // ---------------------------
  // USERS
  // ---------------------------
  const upsertUserStmt = db.prepare(`
    INSERT INTO users(user_id, join_date, chosen_vibe, inferred_vibe, created_at, updated_at)
    VALUES(@user_id, @join_date, NULL, NULL, @created_at, @updated_at)
    ON CONFLICT(user_id) DO UPDATE SET
      updated_at = excluded.updated_at,
      join_date = COALESCE(users.join_date, excluded.join_date)
  `);

  const setJoinDateIfNullStmt = db.prepare(`
    UPDATE users
    SET join_date = COALESCE(join_date, @join_date),
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setChosenVibeStmt = db.prepare(`
    UPDATE users
    SET chosen_vibe = @chosen_vibe,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setInferredVibeStmt = db.prepare(`
    UPDATE users
    SET inferred_vibe = @inferred_vibe,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setLastMessageStmt = db.prepare(`
    UPDATE users
    SET last_message_at = @at,
        last_message_channel_id = @channel_id,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setLastVcStmt = db.prepare(`
    UPDATE users
    SET last_vc_at = @at,
        last_vc_channel_id = @channel_id,
        last_vc_minutes = @minutes,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setLastConnectionStmt = db.prepare(`
    UPDATE users
    SET last_connection_at = @at,
        last_connection_user_id = @other_user_id,
        last_connection_via = @via,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const setLastSeenStmt = db.prepare(`
    UPDATE users
    SET last_seen_at = @at,
        last_seen_type = @type,
        last_seen_channel_id = @channel_id,
        updated_at = @updated_at
    WHERE user_id = @user_id
  `);

  const getUserStmt = db.prepare(`
    SELECT
      user_id, join_date, chosen_vibe, inferred_vibe,

      last_message_at, last_message_channel_id,
      last_vc_at, last_vc_channel_id, last_vc_minutes,
      last_connection_at, last_connection_user_id, last_connection_via,
      last_seen_at, last_seen_type, last_seen_channel_id,

      created_at, updated_at
    FROM users
    WHERE user_id = ?
  `);

  const listUsersVibesStmt = db.prepare(`
    SELECT user_id, chosen_vibe, inferred_vibe
    FROM users
    WHERE chosen_vibe IS NOT NULL OR inferred_vibe IS NOT NULL
  `);

  // ---------------------------
  // ACTIVITY (global)
  // ---------------------------
  const addMessageStmt = db.prepare(`
    INSERT INTO activity_daily(
      user_id, date,
      messages_count, voice_minutes,
      bucket_night, bucket_morning, bucket_afternoon, bucket_evening,
      weekend_count
    )
    VALUES(
      @user_id, @date,
      @messages_count, 0,
      @bucket_night, @bucket_morning, @bucket_afternoon, @bucket_evening,
      @weekend_count
    )
    ON CONFLICT(user_id, date) DO UPDATE SET
      messages_count = activity_daily.messages_count + excluded.messages_count,
      bucket_night = activity_daily.bucket_night + excluded.bucket_night,
      bucket_morning = activity_daily.bucket_morning + excluded.bucket_morning,
      bucket_afternoon = activity_daily.bucket_afternoon + excluded.bucket_afternoon,
      bucket_evening = activity_daily.bucket_evening + excluded.bucket_evening,
      weekend_count = activity_daily.weekend_count + excluded.weekend_count
  `);

  const addVoiceStmt = db.prepare(`
    INSERT INTO activity_daily(
      user_id, date,
      messages_count, voice_minutes,
      bucket_night, bucket_morning, bucket_afternoon, bucket_evening,
      weekend_count
    )
    VALUES(
      @user_id, @date,
      0, @voice_minutes,
      @bucket_night, @bucket_morning, @bucket_afternoon, @bucket_evening,
      @weekend_count
    )
    ON CONFLICT(user_id, date) DO UPDATE SET
      voice_minutes = activity_daily.voice_minutes + excluded.voice_minutes,
      bucket_night = activity_daily.bucket_night + excluded.bucket_night,
      bucket_morning = activity_daily.bucket_morning + excluded.bucket_morning,
      bucket_afternoon = activity_daily.bucket_afternoon + excluded.bucket_afternoon,
      bucket_evening = activity_daily.bucket_evening + excluded.bucket_evening,
      weekend_count = activity_daily.weekend_count + excluded.weekend_count
  `);

  const getTotalsStmt = db.prepare(`
    SELECT
      COALESCE(SUM(bucket_night), 0) AS night,
      COALESCE(SUM(bucket_morning), 0) AS morning,
      COALESCE(SUM(bucket_afternoon), 0) AS afternoon,
      COALESCE(SUM(bucket_evening), 0) AS evening,
      COALESCE(SUM(weekend_count), 0) AS weekend,
      COALESCE(SUM(messages_count), 0) AS messages,
      COALESCE(SUM(voice_minutes), 0) AS voice
    FROM activity_daily
    WHERE user_id = ?
  `);

  const topMessagesStmt = db.prepare(`
    SELECT user_id, COALESCE(SUM(messages_count), 0) AS value
    FROM activity_daily
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const topVoiceStmt = db.prepare(`
    SELECT user_id, COALESCE(SUM(voice_minutes), 0) AS value
    FROM activity_daily
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const topNightStmt = db.prepare(`
    SELECT user_id, COALESCE(SUM(bucket_night), 0) AS value
    FROM activity_daily
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const topMessagesBetweenStmt = db.prepare(`
    SELECT user_id, COALESCE(SUM(messages_count), 0) AS value
    FROM activity_daily
    WHERE date >= ? AND date < ?
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const topVoiceBetweenStmt = db.prepare(`
    SELECT user_id, COALESCE(SUM(voice_minutes), 0) AS value
    FROM activity_daily
    WHERE date >= ? AND date < ?
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const totalsBetweenStmt = db.prepare(`
    SELECT
      COALESCE(SUM(messages_count), 0) AS messages,
      COALESCE(SUM(voice_minutes), 0) AS voice
    FROM activity_daily
    WHERE date >= ? AND date < ?
  `);

  // ---------------------------
  // ACTIVITY (scoped) ✅ NEW
  // ---------------------------
  const addMessageScopedStmt = db.prepare(`
    INSERT INTO activity_scoped_daily(
      user_id, date, category_id,
      messages_count, voice_minutes,
      bucket_night, bucket_morning, bucket_afternoon, bucket_evening,
      weekend_count
    )
    VALUES(
      @user_id, @date, @category_id,
      @messages_count, 0,
      @bucket_night, @bucket_morning, @bucket_afternoon, @bucket_evening,
      @weekend_count
    )
    ON CONFLICT(user_id, date, category_id) DO UPDATE SET
      messages_count = activity_scoped_daily.messages_count + excluded.messages_count,
      bucket_night = activity_scoped_daily.bucket_night + excluded.bucket_night,
      bucket_morning = activity_scoped_daily.bucket_morning + excluded.bucket_morning,
      bucket_afternoon = activity_scoped_daily.bucket_afternoon + excluded.bucket_afternoon,
      bucket_evening = activity_scoped_daily.bucket_evening + excluded.bucket_evening,
      weekend_count = activity_scoped_daily.weekend_count + excluded.weekend_count
  `);

  const addVoiceScopedStmt = db.prepare(`
    INSERT INTO activity_scoped_daily(
      user_id, date, category_id,
      messages_count, voice_minutes,
      bucket_night, bucket_morning, bucket_afternoon, bucket_evening,
      weekend_count
    )
    VALUES(
      @user_id, @date, @category_id,
      0, @voice_minutes,
      @bucket_night, @bucket_morning, @bucket_afternoon, @bucket_evening,
      @weekend_count
    )
    ON CONFLICT(user_id, date, category_id) DO UPDATE SET
      voice_minutes = activity_scoped_daily.voice_minutes + excluded.voice_minutes,
      bucket_night = activity_scoped_daily.bucket_night + excluded.bucket_night,
      bucket_morning = activity_scoped_daily.bucket_morning + excluded.bucket_morning,
      bucket_afternoon = activity_scoped_daily.bucket_afternoon + excluded.bucket_afternoon,
      bucket_evening = activity_scoped_daily.bucket_evening + excluded.bucket_evening,
      weekend_count = activity_scoped_daily.weekend_count + excluded.weekend_count
  `);

  function makeInPlaceholders(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "NULL";
    return Array.from({ length: n }).map(() => "?").join(", ");
  }

  function getTotalsScopedImpl(userId: string, categoryIds: string[]): ScopedTotals {
    if (!categoryIds?.length) {
      return { messages: 0, voice: 0, night: 0, morning: 0, afternoon: 0, evening: 0, weekend: 0 };
    }

    const sql = `
      SELECT
        COALESCE(SUM(bucket_night), 0) AS night,
        COALESCE(SUM(bucket_morning), 0) AS morning,
        COALESCE(SUM(bucket_afternoon), 0) AS afternoon,
        COALESCE(SUM(bucket_evening), 0) AS evening,
        COALESCE(SUM(weekend_count), 0) AS weekend,
        COALESCE(SUM(messages_count), 0) AS messages,
        COALESCE(SUM(voice_minutes), 0) AS voice
      FROM activity_scoped_daily
      WHERE user_id = ?
        AND category_id IN (${makeInPlaceholders(categoryIds.length)})
    `;

    try {
      const row = db.prepare(sql).get(userId, ...categoryIds) as any;
      return {
        night: Number(row?.night ?? 0),
        morning: Number(row?.morning ?? 0),
        afternoon: Number(row?.afternoon ?? 0),
        evening: Number(row?.evening ?? 0),
        weekend: Number(row?.weekend ?? 0),
        messages: Number(row?.messages ?? 0),
        voice: Number(row?.voice ?? 0)
      };
    } catch (err) {
      logger.error("DB activity.getTotalsScoped failed", { err: err instanceof Error ? err.message : String(err) });
      return { messages: 0, voice: 0, night: 0, morning: 0, afternoon: 0, evening: 0, weekend: 0 };
    }
  }

  function topScopedSum(column: "messages_count" | "voice_minutes" | "bucket_night", categoryIds: string[], limit: number): ScopedLeaderboardRow[] {
    if (!categoryIds?.length) return [];
    const sql = `
      SELECT user_id, COALESCE(SUM(${column}), 0) AS value
      FROM activity_scoped_daily
      WHERE category_id IN (${makeInPlaceholders(categoryIds.length)})
      GROUP BY user_id
      ORDER BY value DESC
      LIMIT ?
    `;
    try {
      return db.prepare(sql).all(...categoryIds, limit) as ScopedLeaderboardRow[];
    } catch (err) {
      logger.error("DB activity.topScopedSum failed", { err: err instanceof Error ? err.message : String(err) });
      return [];
    }
  }

  function topScopedSumBetween(
    column: "messages_count" | "voice_minutes",
    categoryIds: string[],
    startDateKey: string,
    endDateKey: string,
    limit: number
  ): ScopedLeaderboardRow[] {
    if (!categoryIds?.length) return [];
    const sql = `
      SELECT user_id, COALESCE(SUM(${column}), 0) AS value
      FROM activity_scoped_daily
      WHERE date >= ? AND date < ?
        AND category_id IN (${makeInPlaceholders(categoryIds.length)})
      GROUP BY user_id
      ORDER BY value DESC
      LIMIT ?
    `;
    try {
      return db.prepare(sql).all(startDateKey, endDateKey, ...categoryIds, limit) as ScopedLeaderboardRow[];
    } catch (err) {
      logger.error("DB activity.topScopedSumBetween failed", { err: err instanceof Error ? err.message : String(err) });
      return [];
    }
  }

  function totalsScopedBetweenImpl(categoryIds: string[], startDateKey: string, endDateKey: string): { messages: number; voice: number } {
    if (!categoryIds?.length) return { messages: 0, voice: 0 };
    const sql = `
      SELECT
        COALESCE(SUM(messages_count), 0) AS messages,
        COALESCE(SUM(voice_minutes), 0) AS voice
      FROM activity_scoped_daily
      WHERE date >= ? AND date < ?
        AND category_id IN (${makeInPlaceholders(categoryIds.length)})
    `;
    try {
      const row = db.prepare(sql).get(startDateKey, endDateKey, ...categoryIds) as any;
      return { messages: Number(row?.messages ?? 0), voice: Number(row?.voice ?? 0) };
    } catch (err) {
      logger.error("DB activity.totalsScopedBetween failed", { err: err instanceof Error ? err.message : String(err) });
      return { messages: 0, voice: 0 };
    }
  }

  // ---------------------------
  // INTERACTIONS
  // ---------------------------
  const addInteractionDeltaStmt = db.prepare(`
    INSERT INTO interactions(
      user_id, other_user_id,
      mentions, replies, vc_minutes_together,
      last_interaction_at
    )
    VALUES(
      @user_id, @other_user_id,
      @mentions, @replies, @vc_minutes_together,
      @last_interaction_at
    )
    ON CONFLICT(user_id, other_user_id) DO UPDATE SET
      mentions = interactions.mentions + excluded.mentions,
      replies = interactions.replies + excluded.replies,
      vc_minutes_together = interactions.vc_minutes_together + excluded.vc_minutes_together,
      last_interaction_at = excluded.last_interaction_at
  `);

  const topMostSeenWithStmt = db.prepare(`
    SELECT
      other_user_id,
      mentions,
      replies,
      vc_minutes_together,
      (mentions * 2 + replies * 3 + vc_minutes_together) AS score,
      last_interaction_at
    FROM interactions
    WHERE user_id = ?
    ORDER BY score DESC, COALESCE(last_interaction_at, '') DESC
    LIMIT ?
  `);

  const getPairStmt = db.prepare(`
    SELECT user_id, other_user_id, mentions, replies, vc_minutes_together, last_interaction_at
    FROM interactions
    WHERE user_id = ? AND other_user_id = ?
    LIMIT 1
  `);

  const topUsersByScoreStmt = db.prepare(`
    SELECT
      user_id,
      COALESCE(SUM(mentions * 2 + replies * 3 + vc_minutes_together), 0) AS value
    FROM interactions
    GROUP BY user_id
    ORDER BY value DESC
    LIMIT ?
  `);

  const interactionsSummaryStmt = db.prepare(`
    SELECT
      COALESCE(COUNT(*), 0) AS links,
      COALESCE(SUM(mentions * 2 + replies * 3 + vc_minutes_together), 0) AS score
    FROM interactions
    WHERE user_id = ?
  `);

  // ---------------------------
  // MOMENTS
  // ---------------------------
  const insertMomentStmt = db.prepare(`
    INSERT INTO moments(user_id, type, meta, created_at)
    VALUES(@user_id, @type, @meta, @created_at)
  `);

  const getMomentByTypeStmt = db.prepare(`
    SELECT id, user_id, type, meta, created_at
    FROM moments
    WHERE user_id = ? AND type = ?
    ORDER BY created_at ASC
    LIMIT 1
  `);

  const getEarliestMomentStmt = db.prepare(`
    SELECT id, user_id, type, meta, created_at
    FROM moments
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT 1
  `);

  const listRecentMomentsStmt = db.prepare(`
    SELECT id, meta, created_at
    FROM moments
    WHERE user_id = ? AND type = 'MOMENT_NOTE'
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const deleteMomentByIdForUserStmt = db.prepare(`
    DELETE FROM moments
    WHERE id = ? AND user_id = ? AND type = 'MOMENT_NOTE'
  `);

  const countNotesBetweenStmt = db.prepare(`
    SELECT COUNT(*) AS c
    FROM moments
    WHERE type = 'MOMENT_NOTE'
      AND created_at >= ?
      AND created_at < ?
  `);

  const listRecentNotesBetweenStmt = db.prepare(`
    SELECT user_id, meta, created_at
    FROM moments
    WHERE type = 'MOMENT_NOTE'
      AND created_at >= ?
      AND created_at < ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  // ---------------------------
  // CHANNEL OWNERSHIP
  // ---------------------------
  const upsertCreatedChannelStmt = db.prepare(`
    INSERT INTO created_channels(channel_id, guild_id, creator_user_id, channel_type, created_at)
    VALUES(@channel_id, @guild_id, @creator_user_id, @channel_type, @created_at)
    ON CONFLICT(channel_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      creator_user_id = excluded.creator_user_id,
      channel_type = excluded.channel_type,
      created_at = excluded.created_at
  `);

  const getCreatorUserIdStmt = db.prepare(`
    SELECT creator_user_id
    FROM created_channels
    WHERE channel_id = ?
    LIMIT 1
  `);

  // ---------------------------
  // RECAP RUNS
  // ---------------------------
  const hasRecapRunStmt = db.prepare(`
    SELECT week_start
    FROM recap_runs
    WHERE week_start = ?
    LIMIT 1
  `);

  const markRecapRunStmt = db.prepare(`
    INSERT INTO recap_runs(week_start, posted_at, channel_id, message_id)
    VALUES(@week_start, @posted_at, @channel_id, @message_id)
    ON CONFLICT(week_start) DO UPDATE SET
      posted_at = excluded.posted_at,
      channel_id = excluded.channel_id,
      message_id = excluded.message_id
  `);

  return {
    users: {
      upsertUser(userId: string, joinIso: string | null) {
        try {
          upsertUserStmt.run({
            user_id: userId,
            join_date: joinIso,
            created_at: nowIso(),
            updated_at: nowIso()
          });
        } catch (err) {
          logger.error("DB users.upsertUser failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setJoinDateIfNull(userId: string, joinIso: string) {
        try {
          setJoinDateIfNullStmt.run({ user_id: userId, join_date: joinIso, updated_at: nowIso() });
        } catch (err) {
          logger.error("DB users.setJoinDateIfNull failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setChosenVibe(userId: string, chosenJson: string) {
        try {
          setChosenVibeStmt.run({ user_id: userId, chosen_vibe: chosenJson, updated_at: nowIso() });
        } catch (err) {
          logger.error("DB users.setChosenVibe failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setInferredVibe(userId: string, inferredJson: string) {
        try {
          setInferredVibeStmt.run({ user_id: userId, inferred_vibe: inferredJson, updated_at: nowIso() });
        } catch (err) {
          logger.error("DB users.setInferredVibe failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setLastMessage(userId: string, atIso: string, channelId: string) {
        try {
          setLastMessageStmt.run({
            user_id: userId,
            at: atIso,
            channel_id: channelId,
            updated_at: nowIso()
          });
        } catch (err) {
          logger.error("DB users.setLastMessage failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setLastVc(userId: string, atIso: string, channelId: string, minutes: number) {
        try {
          setLastVcStmt.run({
            user_id: userId,
            at: atIso,
            channel_id: channelId,
            minutes,
            updated_at: nowIso()
          });
        } catch (err) {
          logger.error("DB users.setLastVc failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setLastConnection(userId: string, atIso: string, otherUserId: string, via: "reply" | "mention" | "vc") {
        try {
          setLastConnectionStmt.run({
            user_id: userId,
            at: atIso,
            other_user_id: otherUserId,
            via,
            updated_at: nowIso()
          });
        } catch (err) {
          logger.error("DB users.setLastConnection failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      setLastSeen(userId: string, atIso: string, type: "message" | "voice" | "connection" | "command", channelId: string | null) {
        try {
          setLastSeenStmt.run({
            user_id: userId,
            at: atIso,
            type,
            channel_id: channelId,
            updated_at: nowIso()
          });
        } catch (err) {
          logger.error("DB users.setLastSeen failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      getUser(userId: string) {
        try {
          return getUserStmt.get(userId) as UserRow | undefined;
        } catch (err) {
          logger.error("DB users.getUser failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
        }
      },

      listUsersVibes() {
        try {
          return listUsersVibesStmt.all() as UserVibeRow[];
        } catch (err) {
          logger.error("DB users.listUsersVibes failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      }
    },

    activity: {
      addMessage(userId: string, dateKey: string, bucket: BucketKey, weekendDelta: number) {
        try {
          addMessageStmt.run({
            user_id: userId,
            date: dateKey,
            messages_count: 1,
            bucket_night: bucket === "night" ? 1 : 0,
            bucket_morning: bucket === "morning" ? 1 : 0,
            bucket_afternoon: bucket === "afternoon" ? 1 : 0,
            bucket_evening: bucket === "evening" ? 1 : 0,
            weekend_count: weekendDelta
          });
        } catch (err) {
          logger.error("DB activity.addMessage failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      addVoice(userId: string, dateKey: string, minutes: number, bucketDeltas: Record<BucketKey, number>, weekendDelta: number) {
        try {
          addVoiceStmt.run({
            user_id: userId,
            date: dateKey,
            voice_minutes: minutes,
            bucket_night: bucketDeltas.night ?? 0,
            bucket_morning: bucketDeltas.morning ?? 0,
            bucket_afternoon: bucketDeltas.afternoon ?? 0,
            bucket_evening: bucketDeltas.evening ?? 0,
            weekend_count: weekendDelta
          });
        } catch (err) {
          logger.error("DB activity.addVoice failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      getTotals(userId: string) {
        try {
          const row = getTotalsStmt.get(userId) as any;
          return {
            night: Number(row?.night ?? 0),
            morning: Number(row?.morning ?? 0),
            afternoon: Number(row?.afternoon ?? 0),
            evening: Number(row?.evening ?? 0),
            weekend: Number(row?.weekend ?? 0),
            messages: Number(row?.messages ?? 0),
            voice: Number(row?.voice ?? 0)
          } satisfies ActivityTotals;
        } catch (err) {
          logger.error("DB activity.getTotals failed", { err: err instanceof Error ? err.message : String(err) });
          return { night: 0, morning: 0, afternoon: 0, evening: 0, weekend: 0, messages: 0, voice: 0 };
        }
      },

      topMessages(limit: number) {
        try {
          return topMessagesStmt.all(limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB activity.topMessages failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      topVoice(limit: number) {
        try {
          return topVoiceStmt.all(limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB activity.topVoice failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      topNight(limit: number) {
        try {
          return topNightStmt.all(limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB activity.topNight failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      topMessagesBetween(startDateKey: string, endDateKey: string, limit: number) {
        try {
          return topMessagesBetweenStmt.all(startDateKey, endDateKey, limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB activity.topMessagesBetween failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      topVoiceBetween(startDateKey: string, endDateKey: string, limit: number) {
        try {
          return topVoiceBetweenStmt.all(startDateKey, endDateKey, limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB activity.topVoiceBetween failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      totalsBetween(startDateKey: string, endDateKey: string) {
        try {
          const row = totalsBetweenStmt.get(startDateKey, endDateKey) as any;
          return {
            messages: Number(row?.messages ?? 0),
            voice: Number(row?.voice ?? 0)
          };
        } catch (err) {
          logger.error("DB activity.totalsBetween failed", { err: err instanceof Error ? err.message : String(err) });
          return { messages: 0, voice: 0 };
        }
      },

      // ✅ NEW: scoped methods
      addMessageScoped(userId: string, dateKey: string, categoryId: string, bucket: BucketKey, weekendDelta: number) {
        try {
          addMessageScopedStmt.run({
            user_id: userId,
            date: dateKey,
            category_id: categoryId,
            messages_count: 1,
            bucket_night: bucket === "night" ? 1 : 0,
            bucket_morning: bucket === "morning" ? 1 : 0,
            bucket_afternoon: bucket === "afternoon" ? 1 : 0,
            bucket_evening: bucket === "evening" ? 1 : 0,
            weekend_count: weekendDelta
          });
        } catch (err) {
          logger.error("DB activity.addMessageScoped failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      addVoiceScoped(userId: string, dateKey: string, categoryId: string, minutes: number, bucketDeltas: Record<BucketKey, number>, weekendDelta: number) {
        try {
          addVoiceScopedStmt.run({
            user_id: userId,
            date: dateKey,
            category_id: categoryId,
            voice_minutes: minutes,
            bucket_night: bucketDeltas.night ?? 0,
            bucket_morning: bucketDeltas.morning ?? 0,
            bucket_afternoon: bucketDeltas.afternoon ?? 0,
            bucket_evening: bucketDeltas.evening ?? 0,
            weekend_count: weekendDelta
          });
        } catch (err) {
          logger.error("DB activity.addVoiceScoped failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      getTotalsScoped(userId: string, categoryIds: string[]) {
        return getTotalsScopedImpl(userId, categoryIds);
      },

      topMessagesScoped(categoryIds: string[], limit: number) {
        return topScopedSum("messages_count", categoryIds, limit);
      },

      topVoiceScoped(categoryIds: string[], limit: number) {
        return topScopedSum("voice_minutes", categoryIds, limit);
      },

      topNightScoped(categoryIds: string[], limit: number) {
        return topScopedSum("bucket_night", categoryIds, limit);
      },

      topMessagesScopedBetween(categoryIds: string[], startDateKey: string, endDateKey: string, limit: number) {
        return topScopedSumBetween("messages_count", categoryIds, startDateKey, endDateKey, limit);
      },

      topVoiceScopedBetween(categoryIds: string[], startDateKey: string, endDateKey: string, limit: number) {
        return topScopedSumBetween("voice_minutes", categoryIds, startDateKey, endDateKey, limit);
      },

      totalsScopedBetween(categoryIds: string[], startDateKey: string, endDateKey: string) {
        return totalsScopedBetweenImpl(categoryIds, startDateKey, endDateKey);
      }
    },

    interactions: {
      addDelta({ userId, otherUserId, mentionsDelta, repliesDelta, vcMinutesDelta, lastInteractionAtIso }) {
        try {
          addInteractionDeltaStmt.run({
            user_id: userId,
            other_user_id: otherUserId,
            mentions: mentionsDelta,
            replies: repliesDelta,
            vc_minutes_together: vcMinutesDelta,
            last_interaction_at: lastInteractionAtIso
          });
        } catch (err) {
          logger.error("DB interactions.addDelta failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      topMostSeenWith(userId: string, limit: number) {
        try {
          return topMostSeenWithStmt.all(userId, limit) as InteractionTopRow[];
        } catch (err) {
          logger.error("DB interactions.topMostSeenWith failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      getPair(userId: string, otherUserId: string) {
        try {
          return getPairStmt.get(userId, otherUserId) as InteractionPairRow | undefined;
        } catch (err) {
          logger.error("DB interactions.getPair failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
        }
      },

      topUsersByScore(limit: number) {
        try {
          return topUsersByScoreStmt.all(limit) as Array<{ user_id: string; value: number }>;
        } catch (err) {
          logger.error("DB interactions.topUsersByScore failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      getSummary(userId: string) {
        try {
          const row = interactionsSummaryStmt.get(userId) as any;
          return {
            links: Number(row?.links ?? 0),
            score: Number(row?.score ?? 0)
          };
        } catch (err) {
          logger.error("DB interactions.getSummary failed", { err: err instanceof Error ? err.message : String(err) });
          return { links: 0, score: 0 };
        }
      }
    },

    moments: {
      insert(userId: string, type: string, metaJson: string | null, createdAtIso: string) {
        try {
          insertMomentStmt.run({
            user_id: userId,
            type,
            meta: metaJson,
            created_at: createdAtIso
          });
        } catch (err) {
          logger.error("DB moments.insert failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      getByType(userId: string, type: string) {
        try {
          return getMomentByTypeStmt.get(userId, type) as MomentRow | undefined;
        } catch (err) {
          logger.error("DB moments.getByType failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
        }
      },

      getEarliest(userId: string) {
        try {
          return getEarliestMomentStmt.get(userId) as MomentRow | undefined;
        } catch (err) {
          logger.error("DB moments.getEarliest failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
        }
      },

      listRecent(userId: string, limit: number) {
        try {
          return listRecentMomentsStmt.all(userId, limit) as MomentListRow[];
        } catch (err) {
          logger.error("DB moments.listRecent failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      },

      deleteByIdForUser(id: number, userId: string) {
        try {
          const res = deleteMomentByIdForUserStmt.run(id, userId);
          return (res.changes ?? 0) > 0;
        } catch (err) {
          logger.error("DB moments.deleteByIdForUser failed", { err: err instanceof Error ? err.message : String(err) });
          return false;
        }
      },

      countNotesBetween(startIso: string, endIso: string) {
        try {
          const row = countNotesBetweenStmt.get(startIso, endIso) as any;
          return Number(row?.c ?? 0);
        } catch (err) {
          logger.error("DB moments.countNotesBetween failed", { err: err instanceof Error ? err.message : String(err) });
          return 0;
        }
      },

      listRecentNotesBetween(startIso: string, endIso: string, limit: number) {
        try {
          return listRecentNotesBetweenStmt.all(startIso, endIso, limit) as Array<{ user_id: string; meta: string | null; created_at: string }>;
        } catch (err) {
          logger.error("DB moments.listRecentNotesBetween failed", { err: err instanceof Error ? err.message : String(err) });
          return [];
        }
      }
    },

    channels: {
      upsertCreatedChannel({ channelId, guildId, creatorUserId, channelType, createdAtIso }) {
        try {
          upsertCreatedChannelStmt.run({
            channel_id: channelId,
            guild_id: guildId,
            creator_user_id: creatorUserId,
            channel_type: channelType,
            created_at: createdAtIso
          });
        } catch (err) {
          logger.error("DB channels.upsertCreatedChannel failed", { err: err instanceof Error ? err.message : String(err) });
        }
      },

      getCreatorUserId(channelId: string) {
        try {
          const row = getCreatorUserIdStmt.get(channelId) as any;
          const v = row?.creator_user_id;
          return typeof v === "string" && v.length ? v : undefined;
        } catch (err) {
          logger.error("DB channels.getCreatorUserId failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
        }
      }
    },

    recap: {
      hasRun(weekStartDateKey: string) {
        try {
          const row = hasRecapRunStmt.get(weekStartDateKey) as any;
          return !!row?.week_start;
        } catch (err) {
          logger.error("DB recap.hasRun failed", { err: err instanceof Error ? err.message : String(err) });
          return false;
        }
      },

      markRun({ weekStartDateKey, postedAtIso, channelId, messageId }) {
        try {
          markRecapRunStmt.run({
            week_start: weekStartDateKey,
            posted_at: postedAtIso,
            channel_id: channelId,
            message_id: messageId
          });
        } catch (err) {
          logger.error("DB recap.markRun failed", { err: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  };
}
