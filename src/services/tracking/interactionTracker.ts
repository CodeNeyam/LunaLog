// file: src/services/tracking/interactionTracker.ts
import type { Message } from "discord.js";
import type { Logger } from "../../utils/logger.js";
import type { Statements } from "../../db/statements.js";

export type InteractionTracker = {
  recordFromMessage: (message: Message) => Promise<{
    firstConnectionCandidate: { otherUserId: string; via: "reply" | "mention" } | null;
    lastConnectionCandidate: { otherUserId: string; via: "reply" | "mention" } | null;
  }>;
};

export function createInteractionTracker(deps: { logger: Logger; statements: Statements }): InteractionTracker {
  const { logger, statements } = deps;

  async function recordFromMessage(message: Message): Promise<{
    firstConnectionCandidate: { otherUserId: string; via: "reply" | "mention" } | null;
    lastConnectionCandidate: { otherUserId: string; via: "reply" | "mention" } | null;
  }> {
    const authorId = message.author?.id;
    if (!authorId) return { firstConnectionCandidate: null, lastConnectionCandidate: null };

    const atIso = message.createdAt.toISOString();

    let replyTargetId: string | null = null;
    if (message.reference?.messageId) {
      try {
        const ref = await message.fetchReference();
        if (ref?.author?.id && ref.author.id !== authorId && !ref.author.bot) {
          replyTargetId = ref.author.id;
          statements.interactions.addDelta({
            userId: authorId,
            otherUserId: replyTargetId,
            mentionsDelta: 0,
            repliesDelta: 1,
            vcMinutesDelta: 0,
            lastInteractionAtIso: atIso
          });
        }
      } catch (err) {
        logger.debug("fetchReference failed (ignored)", { err: err instanceof Error ? err.message : String(err) });
      }
    }

    const mentionUsers = message.mentions?.users;
    let firstMentionId: string | null = null;

    if (mentionUsers && mentionUsers.size > 0) {
      for (const [, u] of mentionUsers) {
        if (!u || u.bot) continue;
        if (u.id === authorId) continue;
        if (!firstMentionId) firstMentionId = u.id;

        statements.interactions.addDelta({
          userId: authorId,
          otherUserId: u.id,
          mentionsDelta: 1,
          repliesDelta: 0,
          vcMinutesDelta: 0,
          lastInteractionAtIso: atIso
        });
      }
    }

    // Prefer replies as "the connection" if present; else first mention.
    if (replyTargetId) {
      return {
        firstConnectionCandidate: { otherUserId: replyTargetId, via: "reply" },
        lastConnectionCandidate: { otherUserId: replyTargetId, via: "reply" }
      };
    }

    if (firstMentionId) {
      return {
        firstConnectionCandidate: { otherUserId: firstMentionId, via: "mention" },
        lastConnectionCandidate: { otherUserId: firstMentionId, via: "mention" }
      };
    }

    return { firstConnectionCandidate: null, lastConnectionCandidate: null };
  }

  return { recordFromMessage };
}
