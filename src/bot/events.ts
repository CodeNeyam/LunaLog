// file: src/bot/events.ts
import type { Client } from "discord.js";
import type { Database as DatabaseType } from "better-sqlite3";
import type { Logger } from "../utils/logger.js";
import type { Statements } from "../db/statements.js";
import type { AppConfig } from "../config/types.js";

import util from "node:util";

import { commands } from "../commands/index.js";
import { safeDeferReply, safeReply } from "../utils/discord.js";
import { createMessageTracker } from "../services/tracking/messageTracker.js";
import { createInteractionTracker } from "../services/tracking/interactionTracker.js";
import { createVoiceTracker } from "../services/tracking/voiceTracker.js";
import { createCrewClassifier } from "../services/tracking/crewClassifier.js";
import { createVibeInfer } from "../services/vibe/vibeInfer.js";
import { createMomentsService } from "../services/moments/momentsService.js";

export type BotDeps = {
  logger: Logger;
  db: DatabaseType;
  statements: Statements;
  config: AppConfig;
};

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  try {
    return util.inspect(err, { depth: 6 });
  } catch {
    return String(err);
  }
}

export function registerBotEvents(client: Client, deps: BotDeps): void {
  const { logger, statements, config } = deps;

  const momentsService = createMomentsService({ logger, statements });
  const crewClassifier = createCrewClassifier({ logger, statements });
  const vibeInfer = createVibeInfer({ logger, statements, config });
  const interactionTracker = createInteractionTracker({ logger, statements });

  const messageTracker = createMessageTracker({
    logger,
    statements,
    config,
    momentsService,
    vibeInfer,
    interactionTracker
  });

  const voiceTracker = createVoiceTracker({
    logger,
    statements,
    config,
    momentsService
  });

  client.once("clientReady", (readyClient) => {
    logger.info("Bot ready", { user: readyClient.user?.tag ?? "unknown" });
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      if (!member || member.user?.bot) return;

      const joinIso = member.joinedAt
        ? member.joinedAt.toISOString()
        : new Date().toISOString();

      statements.users.upsertUser(member.id, joinIso);
      await momentsService.ensureMoment(
        member.id,
        "JOINED",
        { guildId: member.guild.id },
        joinIso
      );
    } catch (err) {
      logger.error("guildMemberAdd handler failed", { err: formatErr(err) });
    }
  });

  client.on("messageCreate", async (message) => {
    try {
      await messageTracker.onMessage(message);
    } catch (err) {
      logger.error("messageCreate handler failed", { err: formatErr(err) });
    }
  });

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      await voiceTracker.onVoiceStateUpdate(oldState, newState);
    } catch (err) {
      logger.error("voiceStateUpdate handler failed", { err: formatErr(err) });
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;

      // mark lastSeen as "command"
      try {
        const userId = interaction.user.id;
        statements.users.upsertUser(userId, null);
        statements.users.setLastSeen(
          userId,
          new Date().toISOString(),
          "command",
          null
        );
      } catch {
        // ignore
      }

      const command = commands[interaction.commandName];
      if (!command) {
        await safeReply(interaction, {
          content: "Unknown command.",
          ephemeral: true
        });
        return;
      }

      // Always defer once, then command should editReply/followUp via safe helpers.
      await safeDeferReply(interaction, true);

      await command.execute({
        interaction,
        logger,
        statements,
        config,
        crewClassifier,
        momentsService
      });
    } catch (err) {
      logger.error("interactionCreate handler failed", {
        err: formatErr(err),
        name: (err as any)?.name,
        message: (err as any)?.message
      });

      // Try to inform the user, but don't crash if interaction is already acknowledged.
      try {
        await safeReply(interaction as any, {
          content: "Something went wrong.",
          ephemeral: true
        });
      } catch {
        // ignore
      }
    }
  });
}
