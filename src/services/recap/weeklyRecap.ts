// file: src/services/recap/weeklyRecap.ts
import type { Client } from "discord.js";
import { buildSimpleEmbed } from "../../utils/embeds.js";
import type { Logger } from "../../utils/logger.js";
import type { Statements } from "../../db/statements.js";
import type { AppConfig } from "../../config/types.js";
import { toDateKeyUTC } from "../../utils/time.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Safely add days to a UTC dateKey (YYYY-MM-DD)
 */
function addDaysUtcDateKey(dateKey: string, days: number): string {
  const parts = dateKey.split("-");
  const y = Number(parts[0] ?? 1970);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);

  const base = Date.UTC(y, m - 1, d);
  const next = new Date(base + days * DAY_MS);
  return toDateKeyUTC(next);
}

function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Get local time parts for a given timezone (no external libs)
 */
function getZonedParts(
  d: Date,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun ... 6=Sat
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const wd = (map.weekday ?? "Sun").toLowerCase();
  const weekday =
    wd.startsWith("sun") ? 0 :
    wd.startsWith("mon") ? 1 :
    wd.startsWith("tue") ? 2 :
    wd.startsWith("wed") ? 3 :
    wd.startsWith("thu") ? 4 :
    wd.startsWith("fri") ? 5 :
    6;

  return {
    year: Number(map.year ?? 1970),
    month: Number(map.month ?? 1),
    day: Number(map.day ?? 1),
    hour: Number(map.hour ?? 0),
    minute: Number(map.minute ?? 0),
    weekday
  };
}

/**
 * Convert a "local time in timezone" into UTC ms
 * (iterative correction, no deps, DST-safe)
 */
function zonedToUtcMs(
  args: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
): number {
  let guess = Date.UTC(args.year, args.month - 1, args.day, args.hour, args.minute, 0, 0);

  for (let i = 0; i < 4; i++) {
    const p = getZonedParts(new Date(guess), timeZone);

    const desiredNaive = Date.UTC(
      args.year,
      args.month - 1,
      args.day,
      args.hour,
      args.minute,
      0,
      0
    );

    const gotNaive = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      0,
      0
    );

    const diff = desiredNaive - gotNaive;
    if (diff === 0) break;
    guess += diff;
  }

  return guess;
}

/**
 * Post the weekly recap once (idempotent per week)
 */
async function postWeeklyRecap(deps: {
  client: Client;
  logger: Logger;
  statements: Statements;
  config: AppConfig;
}): Promise<void> {
  const { client, logger, statements, config } = deps;

  const recapCfg = config.settings.recap;
  if (!recapCfg?.enabled) return;

  const channelId = recapCfg.channelId || "1457410392765759601";
  const topN = recapCfg.topN ?? 10;

  // activity_daily is stored using UTC date keys
  const endKey = toDateKeyUTC(new Date());
  const startKey = addDaysUtcDateKey(endKey, -6);
  const endExclusiveKey = addDaysUtcDateKey(endKey, 1);

  // Idempotent: only once per weekStart
  if (statements.recap.hasRun(startKey)) {
    logger.info("Weekly recap skipped (already posted)", { weekStart: startKey });
    return;
  }

  const topChat = statements.activity.topMessagesBetween(
    startKey,
    endExclusiveKey,
    topN
  );

  const topVoice = statements.activity.topVoiceBetween(
    startKey,
    endExclusiveKey,
    topN
  );

  const totals = statements.activity.totalsBetween(
    startKey,
    endExclusiveKey
  );

  const startIso = `${startKey}T00:00:00.000Z`;
  const endIso = `${endExclusiveKey}T00:00:00.000Z`;

  const notesCount = recapCfg.includeMoments
    ? statements.moments.countNotesBetween(startIso, endIso)
    : 0;

  const highlights = recapCfg.includeMoments
    ? statements.moments.listRecentNotesBetween(startIso, endIso, 2)
    : [];

  const chatLines = topChat.length
    ? topChat.map((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        return `${medal} <@${r.user_id}> — **${r.value} msgs**`;
      })
    : ["— No chat data this week."];

  const voiceLines = topVoice.length
    ? topVoice.map((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
        return `${medal} <@${r.user_id}> — **${formatMinutes(r.value)}**`;
      })
    : ["— No voice data this week."];

  const highlightLines =
    highlights.length
      ? highlights.map((h) => {
          let text = "Saved a moment";
          try {
            const parsed = h.meta ? JSON.parse(h.meta) : null;
            if (parsed && typeof parsed === "object") {
              const title = (parsed as any).title;
              const note = (parsed as any).note ?? (parsed as any).text;
              if (typeof title === "string" && title.trim().length) {
                text = title.trim();
              } else if (typeof note === "string" && note.trim().length) {
                text = note.trim();
              }
            }
          } catch {
            // ignore parse errors
          }

          if (text.length > 80) text = text.slice(0, 77) + "...";
          return `• <@${h.user_id}> — ${text}`;
        })
      : ["— No saved moments this week."];

  const lines: string[] = [];

  lines.push(`**Week:** \`${startKey}\` → \`${endKey}\``);
  lines.push("");
  lines.push(`**💬 Top Chatters** (total: ${totals.messages} msgs)`);
  lines.push(...chatLines);
  lines.push("");
  lines.push(`**🎙️ Top Voice** (total: ${formatMinutes(totals.voice)})`);
  lines.push(...voiceLines);

  if (recapCfg.includeMoments) {
    lines.push("");
    lines.push(`**📌 Moments Saved:** ${notesCount}`);
    lines.push(`**✨ Highlights**`);
    lines.push(...highlightLines);
  }

  const embed = buildSimpleEmbed({
    title: "🌙 Weekly Memory Capsule",
    description: lines.join("\n")
  });

  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || !("send" in ch)) {
      logger.warn("Weekly recap: channel not found or not sendable", { channelId });
      return;
    }

    const msg = await (ch as any).send({ embeds: [embed] });

    statements.recap.markRun({
      weekStartDateKey: startKey,
      postedAtIso: new Date().toISOString(),
      channelId,
      messageId: msg?.id ?? null
    });

    logger.info("Weekly recap posted", {
      channelId,
      weekStart: startKey,
      messageId: msg?.id ?? null
    });
  } catch (err) {
    logger.error("Weekly recap post failed", {
      err: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * Schedule the weekly recap (Sunday 23:59 by default)
 */
export function startWeeklyRecapScheduler(deps: {
  client: Client;
  logger: Logger;
  statements: Statements;
  config: AppConfig;
}): void {
  const { client, logger, statements, config } = deps;

  const recapCfg = config.settings.recap;
  if (!recapCfg?.enabled) {
    logger.info("Weekly recap scheduler disabled");
    return;
  }

  const tz = config.settings.timezone || "Africa/Casablanca";

  const scheduleNext = () => {
    try {
      const now = new Date();
      const p = getZonedParts(now, tz);

      const targetWeekday = recapCfg.weekday ?? 0; // Sunday
      let daysUntil = (7 + targetWeekday - p.weekday) % 7;

      const targetHour = recapCfg.hour ?? 23;
      const targetMinute = recapCfg.minute ?? 59;

      const afterTarget =
        p.hour > targetHour ||
        (p.hour === targetHour && p.minute >= targetMinute);

      if (daysUntil === 0 && afterTarget) daysUntil = 7;

      const localMidnightNaive = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        0,
        0,
        0,
        0
      );

      const targetNaive = new Date(
        localMidnightNaive + daysUntil * DAY_MS
      );

      const runAtUtcMs = zonedToUtcMs(
        {
          year: targetNaive.getUTCFullYear(),
          month: targetNaive.getUTCMonth() + 1,
          day: targetNaive.getUTCDate(),
          hour: targetHour,
          minute: targetMinute
        },
        tz
      );

      const delay = Math.max(1_000, runAtUtcMs - Date.now());

      logger.info("Weekly recap scheduled", {
        runAtUtcMs,
        delayMs: delay
      });

      setTimeout(async () => {
        await postWeeklyRecap({ client, logger, statements, config });
        scheduleNext();
      }, delay);
    } catch (err) {
      logger.error("Weekly recap scheduler failed", {
        err: err instanceof Error ? err.message : String(err)
      });
    }
  };

  scheduleNext();
}
