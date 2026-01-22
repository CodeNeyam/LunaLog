// file: src/utils/logger.ts
export type LogLevel = "error" | "warn" | "info" | "debug";

const levelRank: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export type Logger = {
  level: LogLevel;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
};

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {})
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(level: LogLevel): Logger {
  const should = (l: LogLevel) => levelRank[l] <= levelRank[level];

  return {
    level,
    error(msg, meta) {
      if (should("error")) emit("error", msg, meta);
    },
    warn(msg, meta) {
      if (should("warn")) emit("warn", msg, meta);
    },
    info(msg, meta) {
      if (should("info")) emit("info", msg, meta);
    },
    debug(msg, meta) {
      if (should("debug")) emit("debug", msg, meta);
    }
  };
}
