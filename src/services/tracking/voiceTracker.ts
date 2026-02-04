// file: src/services/tracking/voiceTracker.ts
import type { VoiceState } from "discord.js";
import { AuditLogEvent, PermissionsBitField } from "discord.js";
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

// ✅ hardcoded scoped voice category
const SCOPED_VOICE_CATEGORY_ID = "1457409835200151695";

export function createVoiceTracker(deps: {
  logger: Logger;
  statements: Statements;
  config: AppConfig;
  momentsService: MomentsService;
}): VoiceTracker {
  const { logger, statements, config, momentsService } = deps;

  const sessions = new Map<string, VoiceSession>();
  const checkedAuditForChannel = new Set<string>();

  function hasExplicitOwnerOverwrite(channel: any, userId: string): boolean {
    try {
      const ow = channel?.permissionOverwrites?.cache?.get(userId);
      const allow = ow?.allow;
      if (!allow) return false;

      return (
        allow.has(PermissionsBitField.Flags.ManageChannels) ||
        allow.has(PermissionsBitField.Flags.MoveMembers) ||
        allow.has(PermissionsBitField.Flags.MuteMembers)
      );
    } catch {
      return false;
    }
  }

  async function maybeResolveChannelCreatorId(guild: any, channelId: string, channelType: any): Promise<string | undefined> {
    const existing = statements.channels.getCreatorUserId(channelId);
    if (existing) return existing;

    if (!config.settings.personalChannels.useAuditLogs) return undefined;
    if (checkedAuditForChannel.has(channelId)) return undefined;

    checkedAuditForChannel.add(channelId);

    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 8 }).catch(() => null);
      const entry = logs?.entries?.find((e: any) => e?.targetId === channelId);
      const executorId = entry?.executor?.id;
      if (!executorId) return undefined;

      statements.channels.upsertCreatedChannel({
        channelId,
        guildId: guild.id,
        creatorUserId: executorId,
        channelType: String(channelType ?? "unknown"),
        createdAtIso: new Date().toISOString()
      });

      return executorId;
    } catch (err) {
      logger.debug("Voice audit log creator resolve failed (ignored)", { err: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  }

  async function shouldCountVoiceForUser(guild: any, channel: any, userId: string): Promise<boolean> {
    if (!config.settings.personalChannels.excludeCreatorActivity) return true;

    const channelId = channel?.id;
    if (!channelId) return true;

    const creatorId = await maybeResolveChannelCreatorId(guild, channelId, channel?.type);
    if (creatorId && creatorId === userId) return false;

    if (config.settings.personalChannels.useManageOverwriteHeuristic) {
      if (hasExplicitOwnerOverwrite(channel, userId)) return false;
    }

    return true;
  }

  function resolveScopedCategoryId(channel: any): string | undefined {
    try {
      const parentId = channel?.parentId;
      if (typeof parentId !== "string" || !parentId.length) return undefined;
      return parentId === SCOPED_VOICE_CATEGORY_ID ? parentId : undefined;
    } catch {
      return undefined;
    }
  }

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

    const endIso = new Date(endAtMs).toISOString();

    // Keep LAST VC + LAST seen always (even if we skip counting)
    statements.users.setLastVc(userId, endIso, channelId, totalMinutes);
    statements.users.setLastSeen(userId, endIso, "voice", channelId);

    const guild = newState.guild ?? oldState.guild;
    const channel = guild.channels.cache.get(channelId) as any;

    const trackVoice = config.settings.tracking.trackVoice !== false;

    if (trackVoice) {
      const shouldCount = await shouldCountVoiceForUser(guild as any, channel as any, userId);
      if (shouldCount) {
        const split = splitMinutesByBucketUTC(startAt, endAt);

        // ✅ existing global count (unchanged)
        for (const day of split.days) {
          const bucketDeltas: Record<BucketKey, number> = {
            night: day.buckets.night,
            morning: day.buckets.morning,
            afternoon: day.buckets.afternoon,
            evening: day.buckets.evening
          };
          statements.activity.addVoice(userId, day.dateKey, day.totalMinutes, bucketDeltas, day.weekendMinutes);
        }

        // ✅ NEW: scoped voice minutes (only if channel is inside allowed voice category)
        const scopedCategoryId = resolveScopedCategoryId(channel);
        if (scopedCategoryId) {
          for (const day of split.days) {
            const bucketDeltas: Record<BucketKey, number> = {
              night: day.buckets.night,
              morning: day.buckets.morning,
              afternoon: day.buckets.afternoon,
              evening: day.buckets.evening
            };
            statements.activity.addVoiceScoped(
              userId,
              day.dateKey,
              scopedCategoryId,
              day.totalMinutes,
              bucketDeltas,
              day.weekendMinutes
            );
          }
        }
      }
    }

    // FIRST VC moment still works (even if not counted)
    const hasFirstVc = momentsService.getMomentByType(userId, "FIRST_VC");
    if (!hasFirstVc && totalMinutes >= config.settings.minFirstVcMinutes) {
      const meta = {
        channelId,
        channelName: typeof channel?.name === "string" ? channel.name : "unknown",
        minutes: totalMinutes
      };
      await momentsService.ensureMoment(userId, "FIRST_VC", meta, endIso);
    }

    // Overlap tracking stays as-is (not requested to change)
    try {
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
