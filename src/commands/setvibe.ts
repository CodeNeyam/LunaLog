// file: src/commands/setvibe.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";

const VIBES = ["chat", "game", "movie", "music"] as const;
type Vibe = (typeof VIBES)[number];

export const setvibeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setvibe")
    .setDescription("Set your vibe preferences (any combination)")
    .addBooleanOption((opt) => opt.setName("chat").setDescription("💬 Chat"))
    .addBooleanOption((opt) => opt.setName("game").setDescription("🎮 Game"))
    .addBooleanOption((opt) => opt.setName("movie").setDescription("🎬 Movie"))
    .addBooleanOption((opt) => opt.setName("music").setDescription("🎵 Music")),

  async execute({ interaction, statements }) {
    const picked: Vibe[] = [];

    for (const v of VIBES) {
      const val = interaction.options.getBoolean(v);
      if (val === true) picked.push(v);
    }

    if (picked.length === 0) {
      await interaction.editReply("Pick at least one vibe option (chat/game/movie/music).");
      return;
    }

    const userId = interaction.user.id;
    statements.users.upsertUser(userId, null);
    statements.users.setChosenVibe(userId, JSON.stringify(picked));

    const embed = buildSimpleEmbed({
      title: "🌙 Vibe Updated",
      description: `Saved: ${picked
        .map((v) => {
          if (v === "chat") return "💬 Chat";
          if (v === "game") return "🎮 Game";
          if (v === "movie") return "🎬 Movies";
          return "🎵 Music";
        })
        .join(" + ")}`
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
