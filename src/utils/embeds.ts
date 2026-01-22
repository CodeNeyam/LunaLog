// file: src/utils/embeds.ts
import { EmbedBuilder } from "discord.js";

export function buildProfileEmbed(args: {
  title: string;
  crew: string;
  vibe: string;
  firstMemory: string;
  mostSeenWith: string;
  events: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(args.title)
    .setDescription("")
    .addFields(
      { name: "Crew", value: args.crew || "—", inline: true },
      { name: "Vibe", value: args.vibe || "—", inline: true },
      { name: "First memory", value: args.firstMemory || "—", inline: false },
      { name: "Most seen with", value: args.mostSeenWith || "—", inline: false },
      { name: "Events", value: args.events || "Hosted 0 • Joined 0", inline: false }
    )
    .setColor(0x8f7b66)
    .setFooter({ text: "LunaLog • Community Memory" });
}

export function buildJourneyEmbed(args: {
  title: string;
  lines: string[];
  footer: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(args.title)
    .setDescription(args.lines.join("\n"))
    .setColor(0xb89e7c)
    .setFooter({ text: args.footer });
}

export function buildSimpleEmbed(args: { title: string; description: string }): EmbedBuilder {
  return new EmbedBuilder().setTitle(args.title).setDescription(args.description).setColor(0xcbb392);
}
