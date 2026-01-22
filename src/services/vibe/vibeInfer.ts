// file: src/services/vibe/vibeInfer.ts
import type { Message } from "discord.js";
import type { Logger } from "../../utils/logger.js";
import type { Statements, UserRow } from "../../db/statements.js";
import type { AppConfig, VibeKey } from "../../config/types.js";

type VibeScores = Record<VibeKey, number>;

export type VibeInfer = {
  onMessage: (message: Message) => Promise<void>;
};

function parseScores(json: string | null): VibeScores {
  const base: VibeScores = { chat: 0, game: 0, movie: 0, music: 0 };
  if (!json) return base;
  try {
    const obj = JSON.parse(json) as Partial<Record<VibeKey, unknown>>;
    for (const k of Object.keys(base) as VibeKey[]) {
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v)) base[k] = Math.max(0, Math.floor(v));
    }
  } catch {
    // ignore
  }
  return base;
}

export function createVibeInfer(deps: { logger: Logger; statements: Statements; config: AppConfig }): VibeInfer {
  const { logger, statements, config } = deps;

  async function onMessage(message: Message): Promise<void> {
    if (!message.guildId) return;
    if (!message.author || message.author.bot) return;

    const userId = message.author.id;
    const row: UserRow | undefined = statements.users.getUser(userId);
    const current = parseScores(row?.inferred_vibe ?? null);

    const delta: VibeScores = { chat: 0, game: 0, movie: 0, music: 0 };

    // Channel match → +1
    for (const vibe of Object.keys(config.vibes.channels) as VibeKey[]) {
      const ids = config.vibes.channels[vibe];
      if (ids.includes(message.channelId)) delta[vibe] += 1;
    }

    // Keyword match → +1 (case-insensitive, per vibe if any keyword hits)
    const content = (message.content ?? "").toLowerCase();
    if (content.length > 0) {
      for (const vibe of Object.keys(config.vibes.keywords) as VibeKey[]) {
        const keys = config.vibes.keywords[vibe];
        if (keys.some((k) => k && content.includes(k.toLowerCase()))) {
          delta[vibe] += 1;
        }
      }
    }

    const changed = (Object.keys(delta) as VibeKey[]).some((k) => delta[k] !== 0);
    if (!changed) return;

    const next: VibeScores = {
      chat: current.chat + delta.chat,
      game: current.game + delta.game,
      movie: current.movie + delta.movie,
      music: current.music + delta.music
    };

    try {
      statements.users.setInferredVibe(userId, JSON.stringify(next));
    } catch (err) {
      logger.error("setInferredVibe failed", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  return { onMessage };
}
