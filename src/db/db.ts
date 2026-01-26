// file: src/db/db.ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3"; // ✅ runtime import (constructor)
import type { Database as DatabaseType } from "better-sqlite3"; // ✅ type import
import type { Logger } from "../utils/logger.js";
import { schemaSql } from "./schema.js";

function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function openDb(dbPath: string, logger: Logger): DatabaseType {
  ensureDirForFile(dbPath);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  try {
    db.exec(schemaSql);
  } catch (err) {
    logger.error("Failed to initialize DB schema", {
      err: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return db;
}