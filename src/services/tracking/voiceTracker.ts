// file: src/services/tracking/voiceTracker.ts
import type { VoiceState } from "discord.js";
import type { Logger } from "../../utils/logger.js";
import type { Statements, BucketKey } from "../../db/statements.js";
import type { AppConfig } from "../../config/types.js";
import type { MomentsService } from "../moments/momentsService.js";
import { splitMinutesByBucketUTC } from "../../utils/time.js";

type VoiceSession = {
  channelId: string;
  joinedAtMs: number;
};

export type VoiceTracker = {
  onVoiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export function createVoiceTracker(deps: {
  logger: Logger;
  statements: Statements;
  config: AppConfig;
  momentsService: MomentsService;
}): VoiceTracker {
  const { logger, statements, config, momentsService } = deps;

  const sessions = new Map<string, VoiceSession>();

  async function endSession(oldState: VoiceState, newState: VoiceState, userId: string, channelId: string): Promise<void> {
    const session = sessions.get(userId);
    if (!session || session.channelId !== channelId) return;

    const endAtMs = Date.now();
    const startAtMs = session.joinedAtMs;

    const startAt = new Date(Math.floor(startAtMs / 60000) * 60000);
    const endAt = new Date(Math.floor(endAtMs / 60000) * 60000);
    const totalMinutes = Math.floor((endAt.getTime() - startAt.getTime()) / 60000);

    sessions.delete(userId);

    if (totalMinutes <= 0) return;

    const split = splitMinutesByBucketUTC(startAt, endAt);

    for (const day of split.days) {
      const bucketDeltas: Record<BucketKey, number> = {
        night: day.buckets.night,
        morning: day.buckets.morning,
        afternoon: day.buckets.afternoon,
        evening: day.buckets.evening
      };
      statements.activity.addVoice(userId, day.dateKey, day.totalMinutes, bucketDeltas, day.weekendMinutes);
    }

    const hasFirstVc = momentsService.getMomentByType(userId, "FIRST_VC");
    if (!hasFirstVc && totalMinutes >= config.settings.minFirstVcMinutes) {
      const channel = (newState.guild ?? oldState.guild).channels.cache.get(channelId) as any;
      const meta = {
        channelId,
        channelName: typeof channel?.name === "string" ? channel.name : "unknown",
        minutes: totalMinutes
      };
      await momentsService.ensureMoment(userId, "FIRST_VC", meta, new Date(endAtMs).toISOString());
    }

    // Overlap tracking approximation:
    // When a user leaves, compute overlap minutes with users currently still in that channel.
    // overlapStart = max(joinTimes), overlapEnd = now (leave time).
    // This accumulates over time as users leave and rejoin.
    try {
      const guild = newState.guild ?? oldState.guild;
      const channel = guild.channels.cache.get(channelId) as any;
      const members = channel?.members as Map<string, any> | undefined;
      if (!members) return;

      for (const [otherId, member] of members) {
        if (!otherId || otherId === userId) continue;
        const u = member?.user;
        if (u?.bot) continue;

        const otherSession = sessions.get(otherId);
        if (!otherSession || otherSession.channelId !== channelId) continue;

        const overlapStartMs = Math.max(startAtMs, otherSession.joinedAtMs);
        const overlapMinutes = Math.floor((endAtMs - overlapStartMs) / 60000);
        if (overlapMinutes <= 0) continue;

        const atIso = new Date(endAtMs).toISOString();
        statements.interactions.addDelta({
          userId,
          otherUserId: otherId,
          mentionsDelta: 0,
          repliesDelta: 0,
          vcMinutesDelta: overlapMinutes,
          lastInteractionAtIso: atIso
        });
        statements.interactions.addDelta({
          userId: otherId,
          otherUserId: userId,
          mentionsDelta: 0,
          repliesDelta: 0,
          vcMinutesDelta: overlapMinutes,
          lastInteractionAtIso: atIso
        });
      }
    } catch (err) {
      logger.debug("VC overlap tracking failed (ignored)", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const member = newState.member ?? oldState.member ?? null;
    const user = member?.user ?? null;
    if (!user || user.bot) return;

    const userId = user.id;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (!oldChannelId && newChannelId) {
      sessions.set(userId, { channelId: newChannelId, joinedAtMs: Date.now() });
      statements.users.upsertUser(userId, member?.joinedAt ? member.joinedAt.toISOString() : null);
      return;
    }

    if (oldChannelId && !newChannelId) {
      await endSession(oldState, newState, userId, oldChannelId);
      return;
    }

    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      await endSession(oldState, newState, userId, oldChannelId);
      sessions.set(userId, { channelId: newChannelId, joinedAtMs: Date.now() });
      statements.users.upsertUser(userId, member?.joinedAt ? member.joinedAt.toISOString() : null);
    }
  }

  return { onVoiceStateUpdate };
}
