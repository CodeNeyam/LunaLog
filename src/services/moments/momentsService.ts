// file: src/services/moments/momentsService.ts
import type { Logger } from "../../utils/logger.js";
import type { Statements, MomentRow } from "../../db/statements.js";

export type MomentType = "JOINED" | "FIRST_MESSAGE" | "FIRST_VC" | "FIRST_CONNECTION";

export type MomentsService = {
  ensureMoment: (userId: string, type: MomentType, meta: unknown, createdAtIso: string) => Promise<void>;
  getMomentByType: (userId: string, type: MomentType) => MomentRow | undefined;
  getEarliestMoment: (userId: string) => MomentRow | undefined;
};

export function createMomentsService(deps: { logger: Logger; statements: Statements }): MomentsService {
  const { logger, statements } = deps;

  async function ensureMoment(userId: string, type: MomentType, meta: unknown, createdAtIso: string): Promise<void> {
    const exists = statements.moments.getByType(userId, type);
    if (exists) return;

    const metaJson = meta ? JSON.stringify(meta) : null;
    statements.moments.insert(userId, type, metaJson, createdAtIso);
  }

  function getMomentByType(userId: string, type: MomentType): MomentRow | undefined {
    return statements.moments.getByType(userId, type);
  }

  function getEarliestMoment(userId: string): MomentRow | undefined {
    return statements.moments.getEarliest(userId);
  }

  return {
    ensureMoment,
    getMomentByType,
    getEarliestMoment
  };
}
