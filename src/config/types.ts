// file: src/config/types.ts
import { z } from "zod";

export const VibeKeySchema = z.enum(["chat", "game", "movie", "music"]);
export type VibeKey = z.infer<typeof VibeKeySchema>;

export const VibesSchema = z.object({
  channels: z.record(VibeKeySchema, z.array(z.string())),
  keywords: z.record(VibeKeySchema, z.array(z.string()))
});

export type VibesConfig = z.infer<typeof VibesSchema>;

export const SettingsSchema = z.object({
  minFirstVcMinutes: z.number().int().min(1).max(240).default(5),
  maxMostSeenWith: z.number().int().min(1).max(10).default(3)
});

export type SettingsConfig = z.infer<typeof SettingsSchema>;

export type AppConfig = {
  vibes: VibesConfig;
  settings: SettingsConfig;
};
