// file: src/commands/top.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";

type Mode = "chat" | "voice" | "night" | "connections";

const MODE_LABEL: Record<Mode, string> = {
  chat: "💬 Top Chatters (Scoped)",
  voice: "🎙️ Top Voice (Scoped)",
  night: "🌙 Top Night Crew (Scoped)",
  connections: "🔗 Top Connections"
};

// ✅ scoped filters
const MESSAGE_CATEGORY_IDS = [
  "1457409752735682702", // Main Chat
  "1457409790388076871"  // Hobbies
];

const VOICE_CATEGORY_IDS = [
  "1457409835200151695" // Voice Channels category
];

export const topCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("Show server leaderboards (chat / voice / night / connections)")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Leaderboard type")
        .setRequired(true)
        .addChoices(
          { name: "chat", value: "chat" },
          { name: "voice", value: "voice" },
          { name: "night", value: "night" },
          { name: "connections", value: "connections" }
        )
    )
    .addIntegerOption((opt) =>
      opt.setName("limit").setDescription("How many users to show (default 10)").setRequired(false)
    ),

  async execute({ interaction, statements }) {
    const mode = interaction.options.getString("mode", true) as Mode;
    const limit = Math.max(3, Math.min(25, interaction.options.getInteger("limit") ?? 10));

    let rows: Array<{ user_id: string; value: number }> = [];

    // ✅ swap global leaderboards with scoped ones (same command/options)
    if (mode === "chat") rows = statements.activity.topMessagesScoped(MESSAGE_CATEGORY_IDS, limit);
    if (mode === "voice") rows = statements.activity.topVoiceScoped(VOICE_CATEGORY_IDS, limit);
    if (mode === "night") rows = statements.activity.topNightScoped(MESSAGE_CATEGORY_IDS, limit);
    if (mode === "connections") rows = statements.interactions.topUsersByScore(limit);

    const lines = rows.length
      ? rows.map((r, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
          const unit =
            mode === "chat" ? "msgs" :
            mode === "voice" ? "min" :
            mode === "night" ? "night msgs" :
            "score";
          return `${medal} <@${r.user_id}> — **${r.value} ${unit}**`;
        })
      : ["— No data yet. Send messages / join VC / interact and try again."];

    const embed = buildSimpleEmbed({
      title: MODE_LABEL[mode],
      description: lines.join("\n")
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
