// file: src/utils/embeds.ts
import { EmbedBuilder } from "discord.js";

const nonEmpty = (v: string | undefined | null, fallback = " "): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : fallback;
};

export function buildProfileEmbed(args: {
  title: string;
  crew: string;
  vibe: string;
  firstMemory: string;
  mostSeenWith: string;
  events: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(nonEmpty(args.title, "🌙 Profile"))
    // IMPORTANT: description cannot be an empty string in discord.js builders
    .setDescription("Profile snapshot")
    .addFields(
      { name: "Crew", value: nonEmpty(args.crew, "—"), inline: true },
      { name: "Vibe", value: nonEmpty(args.vibe, "—"), inline: true },
      { name: "First memory", value: nonEmpty(args.firstMemory, "—"), inline: false },
      { name: "Most seen with", value: nonEmpty(args.mostSeenWith, "—"), inline: false },
      { name: "Events", value: nonEmpty(args.events, "Hosted 0 • Joined 0"), inline: false }
    )
    .setColor(0x8f7b66)
    .setFooter({ text: "LunaLog • Community Memory" });
}

export function buildJourneyEmbed(args: {
  title: string;
  lines: string[];
  footer: string;
}): EmbedBuilder {
  const desc = args.lines?.length ? args.lines.join("\n") : " ";
  return new EmbedBuilder()
    .setTitle(nonEmpty(args.title, "🌙 Journey"))
    .setDescription(nonEmpty(desc, " "))
    .setColor(0xb89e7c)
    .setFooter({ text: nonEmpty(args.footer, "LunaLog") });
}

export function buildSimpleEmbed(args: { title: string; description: string }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(nonEmpty(args.title, "LunaLog"))
    .setDescription(nonEmpty(args.description, " "))
    .setColor(0xcbb392);
}
