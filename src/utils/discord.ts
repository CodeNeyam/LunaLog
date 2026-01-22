// file: src/utils/discord.ts
import type { Message } from "discord.js";
import type { ChatInputCommandInteraction, InteractionReplyOptions } from "discord.js";

export async function safeFetchMessageIfPartial(message: Message): Promise<Message> {
  if (!message.partial) return message;
  try {
    return await message.fetch();
  } catch {
    return message;
  }
}

export async function safeDeferReply(interaction: ChatInputCommandInteraction, ephemeral: boolean): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) return;
    await interaction.deferReply({ ephemeral });
  } catch {
    // ignore
  }
}

export async function safeReply(
  interaction: ChatInputCommandInteraction,
  options: InteractionReplyOptions & { ephemeral?: boolean }
): Promise<void> {
  try {
    if (interaction.replied) return;
    if (interaction.deferred) {
      await interaction.editReply(options as any);
    } else {
      await interaction.reply(options);
    }
  } catch {
    // ignore
  }
}
