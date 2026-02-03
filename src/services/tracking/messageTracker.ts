// file: src/services/tracking/messageTracker.ts
import type { Message } from "discord.js";
import { AuditLogEvent, PermissionsBitField } from "discord.js";
import type { Logger } from "../../utils/logger.js";
import type { Statements } from "../../db/statements.js";
import type { AppConfig } from "../../config/types.js";
import type { MomentsService } from "../moments/momentsService.js";
import type { VibeInfer } from "../vibe/vibeInfer.js";
import type { InteractionTracker } from "./interactionTracker.js";
import { bucketFromDateUTC, isWeekendUTC, toDateKeyUTC } from "../../utils/time.js";
import { safeFetchMessageIfPartial } from "../../utils/discord.js";

export type MessageTracker = {
  onMessage: (message: Message) => Promise<void>;
};

export function createMessageTracker(deps: {
  logger: Logger;
  statements: Statements;
  config: AppConfig;
  momentsService: MomentsService;
  vibeInfer: VibeInfer;
  interactionTracker: InteractionTracker;
}): MessageTracker {
  const { logger, statements, config, momentsService, vibeInfer, interactionTracker } = deps;

  const checkedAuditForChannel = new Set<string>();

  function hasExplicitOwnerOverwrite(channel: any, userId: string): boolean {
    try {
      const ow = channel?.permissionOverwrites?.cache?.get(userId);
      const allow = ow?.allow;
      if (!allow) return false;

      return (
        allow.has(PermissionsBitField.Flags.ManageChannels) ||
        allow.has(PermissionsBitField.Flags.ManageMessages)
      );
    } catch {
      return false;
    }
  }

  async function maybeResolveChannelCreatorId(full: any, channelId: string): Promise<string | undefined> {
    const existing = statements.channels.getCreatorUserId(channelId);
    if (existing) return existing;

    if (!config.settings.personalChannels.useAuditLogs) return undefined;
    if (checkedAuditForChannel.has(channelId)) return undefined;

    checkedAuditForChannel.add(channelId);

    try {
      const guild = full.guild;
      if (!guild) return undefined;

      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 8 }).catch(() => null);
      const entry = logs?.entries?.find((e: any) => e?.targetId === channelId);
      const executorId = entry?.executor?.id;
      if (!executorId) return undefined;

      statements.channels.upsertCreatedChannel({
        channelId,
        guildId: guild.id,
        creatorUserId: executorId,
        channelType: String((full.channel as any)?.type ?? "unknown"),
        createdAtIso: new Date().toISOString()
      });

      return executorId;
    } catch (err) {
      logger.debug("Audit log creator resolve failed (ignored)", { err: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  }

  async function shouldCountMessageForUser(full: any, userId: string): Promise<boolean> {
    if (!config.settings.personalChannels.excludeCreatorActivity) return true;

    // owner-by-db (created by user)
    const creatorId = await maybeResolveChannelCreatorId(full, full.channelId);
    if (creatorId && creatorId === userId) return false;

    // fallback heuristic
    if (config.settings.personalChannels.useManageOverwriteHeuristic) {
      if (hasExplicitOwnerOverwrite(full.channel, userId)) return false;
    }

    return true;
  }

  async function onMessage(message: Message): Promise<void> {
    if (!message) return;

    if (message.author?.bot) return;
    if (!message.guildId) return;

    const full = await safeFetchMessageIfPartial(message).catch(() => message);

    const userId = full.author?.id;
    if (!userId) return;

    const atIso = full.createdAt.toISOString();

    const joinIso = full.member?.joinedAt ? full.member.joinedAt.toISOString() : null;
    statements.users.upsertUser(userId, joinIso);

    statements.users.setLastMessage(userId, atIso, full.channelId);
    statements.users.setLastSeen(userId, atIso, "message", full.channelId);

    const hasFirstMsg = momentsService.getMomentByType(userId, "FIRST_MESSAGE");
    if (!hasFirstMsg) {
      const channelName = (() => {
        try {
          if ("name" in full.channel && typeof (full.channel as any).name === "string") return (full.channel as any).name as string;
        } catch {
          // ignore
        }
        return "unknown";
      })();

      const meta = {
        channelId: full.channelId,
        channelName
      };

      await momentsService.ensureMoment(userId, "FIRST_MESSAGE", meta, atIso);
    }

    // ✅ Count message only if tracking enabled AND not in user's own channel
    const trackMessages = config.settings.tracking.trackMessages !== false;
    if (trackMessages) {
      const ok = await shouldCountMessageForUser(full as any, userId);
      if (ok) {
        const dateKey = toDateKeyUTC(full.createdAt);
        const bucket = bucketFromDateUTC(full.createdAt);
        const weekendDelta = isWeekendUTC(full.createdAt) ? 1 : 0;
        statements.activity.addMessage(userId, dateKey, bucket, weekendDelta);
      }
    }

    // Interactions
    const { firstConnectionCandidate, lastConnectionCandidate } = await interactionTracker.recordFromMessage(full);

    if (firstConnectionCandidate) {
      const hasFirstConn = momentsService.getMomentByType(userId, "FIRST_CONNECTION");
      if (!hasFirstConn) {
        const meta = {
          otherUserId: firstConnectionCandidate.otherUserId,
          via: firstConnectionCandidate.via,
          channelId: full.channelId
        };
        await momentsService.ensureMoment(userId, "FIRST_CONNECTION", meta, atIso);
      }
    }

    if (lastConnectionCandidate) {
      statements.users.setLastConnection(
        userId,
        atIso,
        lastConnectionCandidate.otherUserId,
        lastConnectionCandidate.via
      );
      statements.users.setLastSeen(userId, atIso, "connection", full.channelId);
    }

    // Vibe inference
    try {
      await vibeInfer.onMessage(full);
    } catch (err) {
      logger.error("vibeInfer.onMessage failed", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  return { onMessage };
}
