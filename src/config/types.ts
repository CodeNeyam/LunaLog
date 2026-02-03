// file: src/config/types.ts
import { z } from "zod";

export const VibeKeySchema = z.enum(["chat", "game", "movie", "music"]);
export type VibeKey = z.infer<typeof VibeKeySchema>;

export const VibesSchema = z.object({
  channels: z.record(VibeKeySchema, z.array(z.string())),
  keywords: z.record(VibeKeySchema, z.array(z.string()))
});

export type VibesConfig = z.infer<typeof VibesSchema>;

const TrackingSchema = z
  .object({
    trackMessages: z.boolean().default(true),
    trackVoice: z.boolean().default(true),
    trackInteractions: z.boolean().default(true)
  })
  .default({
    trackMessages: true,
    trackVoice: true,
    trackInteractions: true
  });

const MomentsSettingsSchema = z
  .object({
    maxPerUser: z.number().int().min(1).max(500).default(50)
  })
  .default({ maxPerUser: 50 });

const CrewBucketSchema = z.object({
  name: z.string().min(1),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23)
});

const PersonalChannelsSchema = z
  .object({
    // Main behavior you asked for:
    // - if user owns the channel (created by them OR explicit manage overwrite) => don't count their stats there
    excludeCreatorActivity: z.boolean().default(true),

    // Best detection method when bot has "View Audit Log" permission
    useAuditLogs: z.boolean().default(true),

    // Fallback detection:
    // if the channel has an explicit permission overwrite for that user granting ManageChannels/ManageMessages
    useManageOverwriteHeuristic: z.boolean().default(true)
  })
  .default({
    excludeCreatorActivity: true,
    useAuditLogs: true,
    useManageOverwriteHeuristic: true
  });

const RecapSchema = z
  .object({
    enabled: z.boolean().default(true),
    channelId: z.string().min(1).default("1457410392765759601"),

    // 0=Sunday ... 6=Saturday
    weekday: z.number().int().min(0).max(6).default(0),
    hour: z.number().int().min(0).max(23).default(23),
    minute: z.number().int().min(0).max(59).default(59),

    topN: z.number().int().min(3).max(25).default(10),
    mentionUsers: z.boolean().default(false),

    includeMoments: z.boolean().default(true)
  })
  .default({
    enabled: true,
    channelId: "1457410392765759601",
    weekday: 0,
    hour: 23,
    minute: 59,
    topN: 10,
    mentionUsers: false,
    includeMoments: true
  });

export const SettingsSchema = z.object({
  timezone: z.string().min(1).default("Africa/Casablanca"),

  tracking: TrackingSchema,
  moments: MomentsSettingsSchema,

  crewBuckets: z.array(CrewBucketSchema).default([]),

  // keep your existing settings (used in voiceTracker + /link)
  minFirstVcMinutes: z.number().int().min(1).max(240).default(5),
  maxMostSeenWith: z.number().int().min(1).max(10).default(3),

  personalChannels: PersonalChannelsSchema,
  recap: RecapSchema
});

export type SettingsConfig = z.infer<typeof SettingsSchema>;

export type AppConfig = {
  vibes: VibesConfig;
  settings: SettingsConfig;
};
