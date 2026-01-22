// file: src/commands/moments.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildJourneyEmbed } from "../utils/embeds.js";
import { formatJourneyLine } from "../services/moments/momentsFormat.js";
import { unixSeconds } from "../utils/time.js";

export const momentsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("moments")
    .setDescription("Show a Journey timeline")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(false)),

  async execute({ interaction, statements, momentsService }) {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const guild = interaction.guild;

    if (!guild) {
      await interaction.editReply("This command can only be used in a server.");
      return;
    }

    const member = await guild.members.fetch({ user: target.id, force: false }).catch(() => null);
    const joinIso = member?.joinedAt ? member.joinedAt.toISOString() : null;

    statements.users.upsertUser(target.id, joinIso);

    const row = statements.users.getUser(target.id);

    const joinedAt = row?.join_date ?? joinIso ?? null;

    const firstMsg = momentsService.getMomentByType(target.id, "FIRST_MESSAGE");
    const firstVc = momentsService.getMomentByType(target.id, "FIRST_VC");
    const firstConn = momentsService.getMomentByType(target.id, "FIRST_CONNECTION");

    const embed = buildJourneyEmbed({
      title: "🌙 Journey",
      lines: [
        formatJourneyLine("Joined server", joinedAt),
        formatJourneyLine("First message", firstMsg?.created_at ?? null, firstMsg?.meta ?? null),
        formatJourneyLine("First VC session", firstVc?.created_at ?? null, firstVc?.meta ?? null),
        formatJourneyLine("First connection", firstConn?.created_at ?? null, firstConn?.meta ?? null)
      ],
      footer: `User: ${target.tag} • Generated at <t:${unixSeconds(new Date())}:t>`
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
