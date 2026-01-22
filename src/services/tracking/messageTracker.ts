// file: src/services/tracking/messageTracker.ts
import type { Message } from "discord.js";
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
  const { logger, statements, momentsService, vibeInfer, interactionTracker } = deps;

  async function onMessage(message: Message): Promise<void> {
    if (!message) return;

    // Ignore bot messages
    if (message.author?.bot) return;

    // Guild only
    if (!message.guildId) return;

    // Ensure full message if partial
    const full = await safeFetchMessageIfPartial(message).catch(() => message);

    const userId = full.author?.id;
    if (!userId) return;

    const atIso = full.createdAt.toISOString();

    // Ensure user row exists
    const joinIso = full.member?.joinedAt ? full.member.joinedAt.toISOString() : null;
    statements.users.upsertUser(userId, joinIso);

    // LAST message + LAST seen
    statements.users.setLastMessage(userId, atIso, full.channelId);
    statements.users.setLastSeen(userId, atIso, "message", full.channelId);

    // First message moment
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

    // Activity counters
    const dateKey = toDateKeyUTC(full.createdAt);
    const bucket = bucketFromDateUTC(full.createdAt);
    const weekendDelta = isWeekendUTC(full.createdAt) ? 1 : 0;
    statements.activity.addMessage(userId, dateKey, bucket, weekendDelta);

    // Interactions + first connection moment + LAST connection snapshot
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

    // Vibe inference (channels + keywords)
    try {
      await vibeInfer.onMessage(full);
    } catch (err) {
      logger.error("vibeInfer.onMessage failed", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  return { onMessage };
}
