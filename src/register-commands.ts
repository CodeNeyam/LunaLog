// file: src/register-commands.ts
import dotenv from "dotenv";
import { REST, Routes } from "discord.js";
import { z } from "zod";
import { commands } from "./commands/index.js";
import { createLogger } from "./utils/logger.js";

dotenv.config();

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
});

const env = EnvSchema.parse({
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  LOG_LEVEL: (process.env.LOG_LEVEL as any) ?? "info"
});

const logger = createLogger(env.LOG_LEVEL);

async function main(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

  const body = Object.values(commands).map((c) => c.data.toJSON());

  try {
    if (env.GUILD_ID) {
      logger.info("Registering commands (GUILD)", { guildId: env.GUILD_ID });
      await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body });
      logger.info("Registered guild commands successfully", { count: body.length });
    } else {
      logger.info("Registering commands (GLOBAL)", {});
      await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body });
      logger.info("Registered global commands successfully", { count: body.length });
    }
  } catch (err) {
    logger.error("Failed to register commands", { err: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  }
}

void main();
