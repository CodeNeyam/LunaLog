// file: src/commands/about.ts
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "./index.js";
import { formatVibeDisplay } from "../services/vibe/vibeFormat.js";
import { formatMomentShort } from "../services/moments/momentsFormat.js";

// ✅ scoped filters
const MESSAGE_CATEGORY_IDS = [
  "1457409752735682702", // Main Chat
  "1457409790388076871"  // Hobbies
];

const VOICE_CATEGORY_IDS = [
  "1457409835200151695" // Voice Channels category
];

function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function tierForScore(score: number): string {
  if (score >= 700) return "👑 Legend";
  if (score >= 300) return "🔥 Grinder";
  if (score >= 100) return "✨ Active";
  return "🌱 New";
}

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

    const member = await guild.members.fetch({ user: target.id, force: false }).catch(() => null);
    const joinIso = member?.joinedAt ? member.joinedAt.toISOString() : null;
    statements.users.upsertUser(target.id, joinIso);

    const userRow = statements.users.getUser(target.id);
    const crew = crewClassifier.classify(target.id);

    // Backfill JOINED moment if needed
    const existingFirst = momentsService.getEarliestMoment(target.id);
    if (!existingFirst) {
      const iso = joinIso ?? new Date().toISOString();
      await momentsService.ensureMoment(
        target.id,
        "JOINED",
        { guildId: guild.id, backfill: true },
        iso
      );
    }

    const firstMoment = momentsService.getEarliestMoment(target.id);
    const firstMemoryText = firstMoment ? formatMomentShort(firstMoment) : "—";
    const vibeText = formatVibeDisplay(userRow, config);

    // ✅ scoped totals
    const scopedChat = statements.activity.getTotalsScoped(target.id, MESSAGE_CATEGORY_IDS);
    const scopedVoice = statements.activity.getTotalsScoped(target.id, VOICE_CATEGORY_IDS);

    const scopedMessages = scopedChat.messages;
    const scopedVoiceMin = scopedVoice.voice;

    // ✅ top connections (3)
    const top3 = statements.interactions.topMostSeenWith(target.id, 3);
    const topConnectionsText = top3.length
      ? top3
          .map((r, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
            return `${medal} <@${r.other_user_id}> (**${r.score}**)`;
          })
          .join("\n")
      : "—";

    // ✅ links summary + interaction score
    const interSummary = statements.interactions.getSummary(target.id);
    const interactionScore = interSummary.score;

    // ✅ score formula
    const score = scopedMessages + scopedVoiceMin * 0.5 + interactionScore;
    const tier = tierForScore(score);

    const embed = new EmbedBuilder()
      .setTitle("🌙 Bound By Will Profile")
      .setColor(0x8f7b66)
      .setDescription(`**${target.username}** • ${tier}`)
      .addFields(
        { name: "Crew", value: crew || "—", inline: true },
        { name: "Vibe", value: vibeText || "—", inline: true },
        { name: "First memory", value: firstMemoryText || "—", inline: false },

        { name: "💬 Scoped Messages", value: `**${scopedMessages}**`, inline: true },
        { name: "🎙️ Scoped VC Minutes", value: `**${formatMinutes(scopedVoiceMin)}**`, inline: true },
        { name: "🔗 Links", value: `**${interSummary.links}**`, inline: true },

        { name: "⭐ Activity Score", value: `**${Math.floor(score)}**  *(msgs + vc×0.5 + links)*`, inline: false },

        { name: "Top Connections", value: topConnectionsText, inline: false }
      )
      .setFooter({ text: "LunaLog • Scoped activity only" });

    await interaction.editReply({ embeds: [embed] });
  }
};
