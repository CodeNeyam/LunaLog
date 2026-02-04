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

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
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

    // Ensure user exists
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

    // First memory + vibe
    const firstMoment = momentsService.getEarliestMoment(target.id);
    const firstMemoryText = firstMoment ? formatMomentShort(firstMoment) : "—";
    const vibeText = formatVibeDisplay(userRow, config);

    // ✅ scoped totals
    const scopedChat = statements.activity.getTotalsScoped(target.id, MESSAGE_CATEGORY_IDS);
    const scopedVoice = statements.activity.getTotalsScoped(target.id, VOICE_CATEGORY_IDS);

    const scopedMessages = safeNumber(scopedChat.messages);
    const scopedVoiceMin = safeNumber(scopedVoice.voice);

    // ✅ connections (use existing method only)
    const topConnections = statements.interactions.topMostSeenWith(
      target.id,
      Math.max(3, config.settings.maxMostSeenWith ?? 10)
    );

    const top3 = topConnections.slice(0, 3);
    const linksCount = topConnections.length;

    const topConnectionsText = top3.length
      ? top3
          .map((r, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
            const score = safeNumber(r.score);
            return `${medal} <@${r.other_user_id}>  •  **${score}**`;
          })
          .join("\n")
      : "—";

    const interactionScore = topConnections.reduce((sum, r) => sum + safeNumber(r.score), 0);

    // ✅ Activity score (no formula shown)
    const score = Math.floor(scopedMessages + scopedVoiceMin * 0.5 + interactionScore);
    const tier = tierForScore(score);

    // last seen snapshot (stored)
    const lastSeenType = userRow?.last_seen_type ?? null;
    const lastSeenAt = userRow?.last_seen_at ? new Date(userRow.last_seen_at) : null;

    const lastSeenLine = lastSeenAt
      ? `• **Last seen:** ${lastSeenType ?? "—"} — <t:${Math.floor(lastSeenAt.getTime() / 1000)}:R>`
      : `• **Last seen:** —`;

    const lastMsgLine =
      userRow?.last_message_at && userRow?.last_message_channel_id
        ? `• **Last message:** <#${userRow.last_message_channel_id}> — <t:${Math.floor(new Date(userRow.last_message_at).getTime() / 1000)}:R>`
        : `• **Last message:** —`;

    const lastVcLine =
      userRow?.last_vc_at && userRow?.last_vc_channel_id
        ? `• **Last VC:** <#${userRow.last_vc_channel_id}> — ${formatMinutes(safeNumber(userRow.last_vc_minutes))} — <t:${Math.floor(new Date(userRow.last_vc_at).getTime() / 1000)}:R>`
        : `• **Last VC:** —`;

    const embed = new EmbedBuilder()
      .setTitle("🌙 Bound By Will Profile")
      .setColor(0x8f7b66)
      .setAuthor({
        name: `${target.username} • ${tier}`,
        iconURL: target.displayAvatarURL({ size: 128 })
      })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `**⭐ Activity Score:** **${score}**`,
          "",
          `**Identity**`,
          `• **Crew:** ${crew || "—"}`,
          `• **Vibe:** ${vibeText || "—"}`,
          "",
          `**Stored Activity (scoped)**`,
          `• 💬 **Messages:** **${scopedMessages}**`,
          `• 🎙️ **VC:** **${formatMinutes(scopedVoiceMin)}**`,
          `• 🔗 **Links:** **${linksCount}**`,
          "",
          `**Timeline**`,
          lastSeenLine,
          lastMsgLine,
          lastVcLine
        ].join("\n")
      )
      .addFields(
        { name: "🧠 First Memory", value: firstMemoryText || "—", inline: false },
        { name: "🤝 Top Connections", value: topConnectionsText, inline: false }
      )
      .setFooter({ text: "LunaLog • Scoped activity tracking" });

    await interaction.editReply({ embeds: [embed] });
  }
};
