// file: src/services/moments/momentsFormat.ts
import type { MomentRow } from "../../db/statements.js";
import { unixSeconds } from "../../utils/time.js";

function safeParseMeta(meta: string | null): any {
  if (!meta) return null;
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

export function formatMomentShort(m: MomentRow): string {
  const meta = safeParseMeta(m.meta);
  const ts = `<t:${unixSeconds(new Date(m.created_at))}:f>`;

  if (m.type === "JOINED") return `Joined server — ${ts}`;
  if (m.type === "FIRST_MESSAGE") {
    const name = meta?.channelName ? `#${meta.channelName}` : "unknown";
    return `First message — ${name} — ${ts}`;
  }
  if (m.type === "FIRST_VC") {
    const name = meta?.channelName ?? "unknown";
    const mins = typeof meta?.minutes === "number" ? `${meta.minutes} min` : "? min";
    return `First VC — ${name} (${mins}) — ${ts}`;
  }
  if (m.type === "FIRST_CONNECTION") {
    const other = meta?.otherUserId ? `<@${meta.otherUserId}>` : "unknown";
    const via = meta?.via === "reply" ? "reply" : "mention";
    return `First connection — ${other} (${via}) — ${ts}`;
  }
  return `Moment — ${ts}`;
}

export function formatJourneyLine(label: string, createdAtIso: string | null, metaJson: string | null = null): string {
  if (!createdAtIso) return `**${label}:** —`;

  const ts = `<t:${unixSeconds(new Date(createdAtIso))}:F>`;
  const meta = safeParseMeta(metaJson);

  if (label === "First message") {
    const ch = meta?.channelName ? `#${meta.channelName}` : "unknown";
    return `**${label}:** ${ch} — ${ts}`;
  }

  if (label === "First VC session") {
    const ch = meta?.channelName ?? "unknown";
    const mins = typeof meta?.minutes === "number" ? `${meta.minutes} min` : "? min";
    return `**${label}:** ${ch} — ${mins} — ${ts}`;
  }

  if (label === "First connection") {
    const other = meta?.otherUserId ? `<@${meta.otherUserId}>` : "unknown";
    return `**${label}:** ${other} — ${ts}`;
  }

  if (label === "Joined server") {
    return `**${label}:** ${ts}`;
  }

  return `**${label}:** ${ts}`;
}
