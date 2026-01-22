// file: src/db/statements.ts
import type Database from "better-sqlite3";
import type { Logger } from "../utils/logger.js";

export type UserRow = {
  user_id: string;
  join_date: string | null;
  chosen_vibe: string | null;
  inferred_vibe: string | null;
  created_at: string;
  updated_at: string;
};

export type MomentRow = {
  id: number;
  user_id: string;
  type: string;
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

export type Statements = {
  users: {
    upsertUser: (userId: string, joinIso: string | null) => void;
    setJoinDateIfNull: (userId: string, joinIso: string) => void;
    setChosenVibe: (userId: string, chosenJson: string) => void;
    setInferredVibe: (userId: string, inferredJson: string) => void;
    getUser: (userId: string) => UserRow | undefined;
  };
  activity: {
    addMessage: (userId: string, dateKey: string, bucket: BucketKey, weekendDelta: number) => void;
    addVoice: (userId: string, dateKey: string, minutes: number, bucketDeltas: Record<BucketKey, number>, weekendDelta: number) => void;
    getTotals: (userId: string) => ActivityTotals;
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
  };
  moments: {
    insert: (userId: string, type: string, metaJson: string | null, createdAtIso: string) => void;
    getByType: (userId: string, type: string) => MomentRow | undefined;
    getEarliest: (userId: string) => MomentRow | undefined;
  };
};

export function buildStatements(db: Database.Database, logger: Logger): Statements {
  const nowIso = () => new Date().toISOString();

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

  const getUserStmt = db.prepare(`
    SELECT user_id, join_date, chosen_vibe, inferred_vibe, created_at, updated_at
    FROM users
    WHERE user_id = ?
  `);

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
      getUser(userId: string) {
        try {
          return getUserStmt.get(userId) as UserRow | undefined;
        } catch (err) {
          logger.error("DB users.getUser failed", { err: err instanceof Error ? err.message : String(err) });
          return undefined;
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
      }
    }
  };
}
