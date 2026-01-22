// file: src/services/tracking/crewClassifier.ts
import type { Logger } from "../../utils/logger.js";
import type { Statements } from "../../db/statements.js";

export type Crew = "Night Crew" | "Morning Crew" | "Afternoon Crew" | "Evening Crew" | "Weekend Crew" | "Mixed";

export type CrewClassifier = {
  classify: (userId: string) => Crew;
};

export function createCrewClassifier(deps: { logger: Logger; statements: Statements }): CrewClassifier {
  const { statements } = deps;

  function classify(userId: string): Crew {
    const totals = statements.activity.getTotals(userId);
    const totalBuckets = totals.night + totals.morning + totals.afternoon + totals.evening;

    if (totalBuckets <= 0) return "Mixed";

    const weekendShare = totals.weekend / totalBuckets;
    if (weekendShare > 0.55) return "Weekend Crew";

    const shares = {
      night: totals.night / totalBuckets,
      morning: totals.morning / totalBuckets,
      afternoon: totals.afternoon / totalBuckets,
      evening: totals.evening / totalBuckets
    };

    if (shares.night > 0.4) return "Night Crew";
    if (shares.morning > 0.4) return "Morning Crew";
    if (shares.afternoon > 0.4) return "Afternoon Crew";
    if (shares.evening > 0.4) return "Evening Crew";

    return "Mixed";
  }

  return { classify };
}
