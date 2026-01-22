// file: src/bot/intents.ts
import { GatewayIntentBits } from "discord.js";

export const requiredIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates
] as const;