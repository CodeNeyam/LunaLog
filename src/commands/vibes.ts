// file: src/commands/vibes.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";
import { formatVibeDisplay } from "../services/vibe/vibeFormat.js";

type VibeKey = "chat" | "game" | "movie" | "music";

function safeParseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export const vibesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("vibes")
    .setDescription("Show vibe info (me/server)")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("me or server")
        .setRequired(true)
        .addChoices(
          { name: "me", value: "me" },
          { name: "server", value: "server" }
        )
    )
    .addUserOption((opt) => opt.setName("user").setDescription("Target user (me mode only)").setRequired(false)),

  async execute({ interaction, statements, config }) {
    const mode = interaction.options.getString("mode", true);

    if (mode === "me") {
      const target = interaction.options.getUser("user") ?? interaction.user;
      statements.users.upsertUser(target.id, null);
      const row = statements.users.getUser(target.id);

      const vibeText = formatVibeDisplay(row, config);

      const embed = buildSimpleEmbed({
        title: "🌙 Vibes",
        description: `User: <@${target.id}>\nVibe: **${vibeText}**`
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // server summary (no JSON1 dependency): fetch all vibe rows and count in JS
    const rows = statements.users.listUsersVibes();

    const counts: Record<VibeKey, number> = { chat: 0, game: 0, movie: 0, music: 0 };
    let usersCounted = 0;

    for (const r of rows) {
      // prefer chosen vibe; fallback inferred vibe
      const chosen = safeParseJsonArray(r.chosen_vibe);
      const inferred = safeParseJsonArray(r.inferred_vibe);
      const list = chosen.length ? chosen : inferred;

      if (!list.length) continue;
      usersCounted++;

      for (const v of list) {
        if (v === "chat" || v === "game" || v === "movie" || v === "music") counts[v]++;
      }
    }

    const embed = buildSimpleEmbed({
      title: "🌙 Server Vibe Map",
      description: [
        `Users counted: **${usersCounted}**`,
        "",
        `💬 Chat: **${counts.chat}**`,
        `🎮 Game: **${counts.game}**`,
        `🎬 Movie: **${counts.movie}**`,
        `🎵 Music: **${counts.music}**`
      ].join("\n")
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
