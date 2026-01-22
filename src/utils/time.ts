// file: src/utils/time.ts
import type { BucketKey } from "../db/statements.js";

export function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export function toDateKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWeekendUTC(d: Date): boolean {
  const wd = d.getUTCDay(); // 0=Sun, 6=Sat
  return wd === 0 || wd === 6;
}

export function bucketFromDateUTC(d: Date): BucketKey {
  const h = d.getUTCHours();
  if (h >= 0 && h < 5) return "night";
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "evening";
}

function nextBoundaryUTC(d: Date): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const date = d.getUTCDate();
  const h = d.getUTCHours();

  if (h < 5) return new Date(Date.UTC(year, month, date, 5, 0, 0, 0));
  if (h < 12) return new Date(Date.UTC(year, month, date, 12, 0, 0, 0));
  if (h < 18) return new Date(Date.UTC(year, month, date, 18, 0, 0, 0));
  // evening → next day 00:00
  return new Date(Date.UTC(year, month, date + 1, 0, 0, 0, 0));
}

export function splitMinutesByBucketUTC(start: Date, end: Date): {
  days: Array<{
    dateKey: string;
    totalMinutes: number;
    weekendMinutes: number;
    buckets: Record<BucketKey, number>;
  }>;
} {
  const startMs = Math.floor(start.getTime() / 60000) * 60000;
  const endMs = Math.floor(end.getTime() / 60000) * 60000;

  if (endMs <= startMs) return { days: [] };

  const resultByDay = new Map<
    string,
    { totalMinutes: number; weekendMinutes: number; buckets: Record<BucketKey, number> }
  >();

  let cursor = new Date(startMs);

  while (cursor.getTime() < endMs) {
    const dayKey = toDateKeyUTC(cursor);
    const bucket = bucketFromDateUTC(cursor);

    const boundary = nextBoundaryUTC(cursor);
    const segEnd = boundary.getTime() > endMs ? new Date(endMs) : boundary;

    const segMinutes = Math.floor((segEnd.getTime() - cursor.getTime()) / 60000);
    if (segMinutes > 0) {
      const cur = resultByDay.get(dayKey) ?? {
        totalMinutes: 0,
        weekendMinutes: 0,
        buckets: { night: 0, morning: 0, afternoon: 0, evening: 0 }
      };
      cur.totalMinutes += segMinutes;
      cur.buckets[bucket] += segMinutes;

      if (isWeekendUTC(cursor)) cur.weekendMinutes += segMinutes;

      resultByDay.set(dayKey, cur);
    }

    cursor = segEnd;
  }

  const days = Array.from(resultByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, v]) => ({
      dateKey,
      totalMinutes: v.totalMinutes,
      weekendMinutes: v.weekendMinutes,
      buckets: v.buckets
    }));

  return { days };
}
