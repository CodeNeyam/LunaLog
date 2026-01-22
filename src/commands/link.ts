// file: src/commands/link.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";

function fmtMaybe(t: string | null | undefined): string {
  if (!t) return "—";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t;
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

export const linkCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Show interaction stats between you and another user")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true)),

  async execute({ interaction, statements }) {
    const me = interaction.user;
    const other = interaction.options.getUser("user", true);

    if (other.id === me.id) {
      await interaction.editReply("Pick someone else 😄");
      return;
    }

    // We store interactions directional, so we need both directions to get a full picture.
    const a = statements.interactions.getPair(me.id, other.id);
    const b = statements.interactions.getPair(other.id, me.id);

    const mentions = (a?.mentions ?? 0) + (b?.mentions ?? 0);
    const replies = (a?.replies ?? 0) + (b?.replies ?? 0);
    const vc = (a?.vc_minutes_together ?? 0) + (b?.vc_minutes_together ?? 0);

    const lastA = a?.last_interaction_at ?? null;
    const lastB = b?.last_interaction_at ?? null;

    const last =
      lastA && lastB
        ? (Date.parse(lastA) >= Date.parse(lastB) ? lastA : lastB)
        : (lastA ?? lastB);

    const score = mentions * 2 + replies * 3 + vc;

    const embed = buildSimpleEmbed({
      title: "🌙 Link",
      description: [
        `You: <@${me.id}>`,
        `Other: <@${other.id}>`,
        "",
        `Mentions: **${mentions}**`,
        `Replies: **${replies}**`,
        `VC overlap: **${vc} min**`,
        `Score: **${score}**`,
        `Last interaction: **${fmtMaybe(last)}**`
      ].join("\n")
    });

    await interaction.editReply({ embeds: [embed] });
  }
};
