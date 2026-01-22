// file: src/commands/about.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildProfileEmbed } from "../utils/embeds.js";
import { formatVibeDisplay } from "../services/vibe/vibeFormat.js";
import { formatMomentShort } from "../services/moments/momentsFormat.js";

export const aboutCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("Show a Bound By Will Profile card")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true)),

  async execute({ interaction, statements, crewClassifier, momentsService, config }) {
    const target = interaction.options.getUser("user", true);
    const guild = interaction.guild;

    if (!guild) {
      await interaction.editReply("This command can only be used in a server.");
      return;
    }

    // Ensure user row exists (also helps if they joined before bot was added)
    const member = await guild.members.fetch({ user: target.id, force: false }).catch(() => null);
    const joinIso = member?.joinedAt ? member.joinedAt.toISOString() : null;
    statements.users.upsertUser(target.id, joinIso);

    const userRow = statements.users.getUser(target.id);
    const crew = crewClassifier.classify(target.id);

    const firstMoment = momentsService.getEarliestMoment(target.id);
    const firstMemoryText = firstMoment ? formatMomentShort(firstMoment) : "—";

    const vibeText = formatVibeDisplay(userRow, config);

    const top = statements.interactions.topMostSeenWith(target.id, config.settings.maxMostSeenWith);
    const mostSeenWithText = top.length
      ? top.map((r) => `<@${r.other_user_id}>`).join(", ")
      : "—";

    const embed = buildProfileEmbed({
      title: "🌙 Bound By Will Profile",
      crew,
      vibe: vibeText,
      firstMemory: firstMemoryText,
      mostSeenWith: mostSeenWithText,
      events: "Hosted 0 • Joined 0"
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
