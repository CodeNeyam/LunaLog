// file: src/commands/moments.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildJourneyEmbed } from "../utils/embeds.js";
import { formatJourneyLine } from "../services/moments/momentsFormat.js";
import { unixSeconds } from "../utils/time.js";

function metaJson(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

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

    // FIRST (from moments table)
    const firstMsg = momentsService.getMomentByType(target.id, "FIRST_MESSAGE");
    const firstVc = momentsService.getMomentByType(target.id, "FIRST_VC");
    const firstConn = momentsService.getMomentByType(target.id, "FIRST_CONNECTION");

    // LAST (from users table snapshot columns)
    const lastMsgAt = row?.last_message_at ?? null;
    const lastMsgMeta =
      row?.last_message_channel_id
        ? metaJson({ channelId: row.last_message_channel_id })
        : null;

    const lastVcAt = row?.last_vc_at ?? null;
    const lastVcMeta =
      row?.last_vc_channel_id
        ? metaJson({
            channelId: row.last_vc_channel_id,
            minutes: row?.last_vc_minutes ?? null
          })
        : null;

    const lastConnAt = row?.last_connection_at ?? null;
    const lastConnMeta =
      row?.last_connection_user_id
        ? metaJson({
            otherUserId: row.last_connection_user_id,
            via: row.last_connection_via ?? "unknown"
          })
        : null;

    const lastSeenAt = row?.last_seen_at ?? null;
    const lastSeenMeta =
      row?.last_seen_type
        ? metaJson({
            type: row.last_seen_type,
            channelId: row?.last_seen_channel_id ?? null
          })
        : null;

    const embed = buildJourneyEmbed({
      title: "🌙 Journey",
      lines: [
        formatJourneyLine("Joined server", joinedAt),

        // Messages
        formatJourneyLine("First message", firstMsg?.created_at ?? null, firstMsg?.meta ?? null),
        formatJourneyLine("Last message", lastMsgAt, lastMsgMeta),

        // Voice
        formatJourneyLine("First VC session", firstVc?.created_at ?? null, firstVc?.meta ?? null),
        formatJourneyLine("Last VC session", lastVcAt, lastVcMeta),

        // Connections
        formatJourneyLine("First connection", firstConn?.created_at ?? null, firstConn?.meta ?? null),
        formatJourneyLine("Last connection", lastConnAt, lastConnMeta),

        // Last seen
        formatJourneyLine("Last seen", lastSeenAt, lastSeenMeta)
      ],
      footer: `User: ${target.tag} • Generated at <t:${unixSeconds(new Date())}:t>`
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
