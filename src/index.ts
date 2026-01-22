// file: src/index.ts
import dotenv from "dotenv";
import { createClient } from "./bot/client.js";
import { registerBotEvents } from "./bot/events.js";
import { createLogger } from "./utils/logger.js";
import { openDb } from "./db/db.js";
import { buildStatements } from "./db/statements.js";
import { loadAppConfig } from "./config/loadConfig.js";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().min(1).optional(),
  DB_PATH: z.string().min(1).default("./data/lunalog.sqlite"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info")
});

const env = EnvSchema.parse({
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  DB_PATH: process.env.DB_PATH ?? "./data/lunalog.sqlite",
  LOG_LEVEL: (process.env.LOG_LEVEL as any) ?? "info"
});

const logger = createLogger(env.LOG_LEVEL);

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { err: err instanceof Error ? err.stack ?? err.message : String(err) });
});

async function main(): Promise<void> {
  const config = loadAppConfig(logger);

  const db = openDb(env.DB_PATH, logger);
  const statements = buildStatements(db, logger);

  const client = createClient(logger);

  registerBotEvents(client, {
    logger,
    db,
    statements,
    config
  });

  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (err) {
    logger.error("Failed to login to Discord", { err: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  }
}

void main();