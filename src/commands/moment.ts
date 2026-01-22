// file: src/commands/moment.ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./index.js";
import { buildSimpleEmbed } from "../utils/embeds.js";

function fmtIso(t: string): string {
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t;
  return `<t:${Math.floor(ms / 1000)}:f>`;
}

export const momentCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("moment")
    .setDescription("Manage personal moments (add/list/delete)")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a new moment")
        .addStringOption((opt) => opt.setName("text").setDescription("What happened?").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("list")
        .setDescription("List recent moments")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user (default you)").setRequired(false))
        .addIntegerOption((opt) => opt.setName("limit").setDescription("Default 10, max 25").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription("Delete one of your moments by id")
        .addIntegerOption((opt) => opt.setName("id").setDescription("Moment id").setRequired(true))
    ),

  async execute({ interaction, statements }) {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const text = interaction.options.getString("text", true).trim();
      if (!text) {
        await interaction.editReply("Moment text can't be empty.");
        return;
      }

      const userId = interaction.user.id;
      statements.users.upsertUser(userId, null);

      const createdAt = new Date().toISOString();
      const meta = JSON.stringify({ text });

      // Store as a MOMENT_NOTE moment type
      statements.moments.insert(userId, "MOMENT_NOTE", meta, createdAt);

      const embed = buildSimpleEmbed({
        title: "🌙 Moment Saved",
        description: `Saved: **${text}**\nTime: ${fmtIso(createdAt)}`
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      const target = interaction.options.getUser("user") ?? interaction.user;
      const limit = Math.max(1, Math.min(25, interaction.options.getInteger("limit") ?? 10));

      statements.users.upsertUser(target.id, null);

      const rows = statements.moments.listRecent(target.id, limit);

      const lines = rows.length
        ? rows.map((r) => {
            let txt = "—";
            try {
              const j = r.meta ? JSON.parse(r.meta) : null;
              if (j?.text) txt = String(j.text);
            } catch {
              // ignore
            }
            return `• **#${r.id}** — ${txt} (${fmtIso(r.created_at)})`;
          })
        : ["— No moments yet. Use `/moment add` to create one."];

      const embed = buildSimpleEmbed({
        title: "🌙 Moments",
        description: `User: <@${target.id}>\n\n${lines.join("\n")}`
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "delete") {
      const id = interaction.options.getInteger("id", true);
      const userId = interaction.user.id;

      const ok = statements.moments.deleteByIdForUser(id, userId);

      const embed = buildSimpleEmbed({
        title: "🌙 Moment Delete",
        description: ok ? `Deleted moment **#${id}**.` : `Can't delete **#${id}** (not found or not yours).`
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }
};
