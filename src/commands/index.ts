// file: src/commands/index.ts
import type { ChatInputCommandInteraction } from "discord.js";
import type { Logger } from "../utils/logger.js";
import type { Statements } from "../db/statements.js";
import type { AppConfig } from "../config/types.js";
import type { CrewClassifier } from "../services/tracking/crewClassifier.js";
import type { MomentsService } from "../services/moments/momentsService.js";

import { aboutCommand } from "./about.js";
import { momentsCommand } from "./moments.js";
import { setvibeCommand } from "./setvibe.js";

import { seenCommand } from "./seen.js";
import { linkCommand } from "./link.js";
import { topCommand } from "./top.js";
import { vibesCommand } from "./vibes.js";
import { momentCommand } from "./moment.js";

export type CommandContext = {
  interaction: ChatInputCommandInteraction;
  logger: Logger;
  statements: Statements;
  config: AppConfig;
  crewClassifier: CrewClassifier;
  momentsService: MomentsService;
};

export type Command = {
  data: any;
  execute: (ctx: CommandContext) => Promise<void>;
};

export const commands: Record<string, Command> = {
  about: aboutCommand,
  moments: momentsCommand,
  setvibe: setvibeCommand,

  seen: seenCommand,
  link: linkCommand,
  top: topCommand,
  vibes: vibesCommand,
  moment: momentCommand
};
