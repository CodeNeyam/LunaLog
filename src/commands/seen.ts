// file: src/commands/seen.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";

function fmtMaybe(t: string | null | undefined): string {
  if (!t) return "—";
  // show in Discord timestamp format if possible
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t;
  return `<t:${Math.floor(ms / 1000)}:f>`;
}

function fmtSeenType(t: string | null | undefined): string {
  if (!t) return "—";
  if (t === "message") return "💬 Message";
  if (t === "voice") return "🎙️ Voice";
  if (t === "connection") return "🔗 Connection";
  if (t === "command") return "⌨️ Command";
  return t;
}

export const seenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("seen")
    .setDescription("Show when a user was last seen (last activity snapshot)")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true)),

  async execute({ interaction, statements }) {
    const target = interaction.options.getUser("user", true);
    statements.users.upsertUser(target.id, null);

    const row = statements.users.getUser(target.id);

    const lastSeenAt = row?.last_seen_at ?? null;
    const lastSeenType = row?.last_seen_type ?? null;
    const lastSeenChannelId = row?.last_seen_channel_id ?? null;

    const where =
      lastSeenChannelId ? `<#${lastSeenChannelId}>` : "—";

    const embed = buildSimpleEmbed({
      title: "🌙 Last Seen",
      description: [
        `User: <@${target.id}>`,
        `Type: **${fmtSeenType(lastSeenType)}**`,
        `When: **${fmtMaybe(lastSeenAt)}**`,
        `Where: **${where}**`
      ].join("\n")
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
