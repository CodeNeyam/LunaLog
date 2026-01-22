// file: src/services/vibe/vibeFormat.ts
import type { UserRow } from "../../db/statements.js";
import type { AppConfig, VibeKey } from "../../config/types.js";

const vibeLabel: Record<VibeKey, string> = {
  chat: "💬 Late Chats",
  game: "🎮 Games",
  movie: "🎬 Movies",
  music: "🎵 Music"
};

function parseChosen(json: string | null): VibeKey[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is VibeKey => v === "chat" || v === "game" || v === "movie" || v === "music");
  } catch {
    return [];
  }
}

function parseScores(json: string | null): Record<VibeKey, number> {
  const base: Record<VibeKey, number> = { chat: 0, game: 0, movie: 0, music: 0 };
  if (!json) return base;
  try {
    const obj = JSON.parse(json) as Partial<Record<VibeKey, unknown>>;
    for (const k of Object.keys(base) as VibeKey[]) {
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v)) base[k] = Math.max(0, Math.floor(v));
    }
  } catch {
    // ignore
  }
  return base;
}

export function formatVibeDisplay(user: UserRow | undefined, config: AppConfig): string {
  const chosen = parseChosen(user?.chosen_vibe ?? null);
  const scores = parseScores(user?.inferred_vibe ?? null);

  const chosenSet = new Set<VibeKey>(chosen);

  const inferredSorted = (Object.keys(scores) as VibeKey[])
    .filter((k) => !chosenSet.has(k))
    .sort((a, b) => scores[b] - scores[a]);

  const inferredTop = inferredSorted.filter((k) => scores[k] > 0).slice(0, 2);

  const final: VibeKey[] = [...chosen, ...inferredTop];

  if (final.length === 0) return "—";

  return final.map((k) => vibeLabel[k]).join(" + ");
}
