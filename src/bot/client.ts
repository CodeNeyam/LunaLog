// file: src/bot/client.ts
import { Client, Partials } from "discord.js";
import { requiredIntents } from "./intents.js";
import type { Logger } from "../utils/logger.js";

export function createClient(logger: Logger): Client {
  const client = new Client({
    intents: [...requiredIntents],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.GuildMember,
      Partials.User,
      Partials.Reaction
    ]
  });

  client.on("error", (err) => logger.error("Discord client error", { err: err.message }));
  client.on("warn", (msg) => logger.warn("Discord client warn", { msg }));

  return client;
}