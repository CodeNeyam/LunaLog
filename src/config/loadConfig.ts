// file: src/config/loadConfig.ts
import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../utils/logger.js";
import { VibesSchema, SettingsSchema } from "./types.js";
import type { AppConfig } from "./types.js";

let cached: AppConfig | null = null;

export function loadAppConfig(logger: Logger): AppConfig {
  if (cached) return cached;

  const vibesPath = path.resolve(process.cwd(), "config", "vibes.json");
  const settingsPath = path.resolve(process.cwd(), "config", "settings.json");

  try {
    const vibesRaw = fs.readFileSync(vibesPath, "utf8");
    const settingsRaw = fs.readFileSync(settingsPath, "utf8");

    const vibes = VibesSchema.parse(JSON.parse(vibesRaw));
    const settings = SettingsSchema.parse(JSON.parse(settingsRaw));

    cached = { vibes, settings };
    return cached;
  } catch (err) {
    logger.error("Failed to load config files", {
      err: err instanceof Error ? err.message : String(err),
      hints: "Ensure config/vibes.json and config/settings.json exist and are valid JSON."
    });
    throw err;
  }
}
