import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/db";

export interface DraftTombstone {
  draftId: number;
  title?: string;
  deletedAt: string;
  reason?: string;
}

const TOMBSTONE_FILE_PATHS = [
  path.join(process.cwd(), ".data", "tombstones.json"),
  path.join(process.cwd(), "public", "tombstones.json"),
];

// In-memory cache for fast lookups
const inMemoryTombstones = new Set<number>();

function loadFileTombstones(): number[] {
  for (const fp of TOMBSTONE_FILE_PATHS) {
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const ids = list.map((item) => (typeof item === "number" ? item : item.draftId));
          ids.forEach((id) => inMemoryTombstones.add(Number(id)));
          return Array.from(inMemoryTombstones);
        }
      }
    } catch {
      // Continue to next path
    }
  }
  return Array.from(inMemoryTombstones);
}

// Initial load
loadFileTombstones();

export async function recordDraftTombstone(
  draftId: number,
  title?: string,
  reason = "user_explicit_deletion"
): Promise<void> {
  const numericId = Number(draftId);
  if (isNaN(numericId)) return;

  inMemoryTombstones.add(numericId);

  // 1. Persist to database if table exists or can be created
  try {
    const db = await getDb();
    if ("exec" in db) {
      await (db as any).exec(`
        CREATE TABLE IF NOT EXISTS deleted_draft_tombstones (
          id serial PRIMARY KEY,
          draft_id integer NOT NULL UNIQUE,
          title text,
          deleted_at timestamptz NOT NULL DEFAULT now(),
          reason text NOT NULL DEFAULT 'user_requested_deletion'
        );
        INSERT INTO deleted_draft_tombstones (draft_id, title, reason)
        VALUES (${numericId}, ${title ? `'${title.replace(/'/g, "''")}'` : "NULL"}, '${reason.replace(/'/g, "''")}')
        ON CONFLICT (draft_id) DO UPDATE SET deleted_at = now();
      `);
    }
  } catch {
    // Database write fallback
  }

  // 2. Persist to filesystem as durable backup across container reboots
  const list = Array.from(inMemoryTombstones).map((id) => ({
    draftId: id,
    title: id === numericId ? title : undefined,
    deletedAt: new Date().toISOString(),
    reason: id === numericId ? reason : "deletion_tombstone",
  }));

  for (const fp of TOMBSTONE_FILE_PATHS) {
    try {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(list, null, 2), "utf-8");
    } catch {
      // ignore
    }
  }
}

export async function isDraftTombstoned(draftId: number): Promise<boolean> {
  const numericId = Number(draftId);
  if (isNaN(numericId)) return false;

  // Check in-memory
  if (inMemoryTombstones.has(numericId)) return true;

  // Reload from files
  const loaded = loadFileTombstones();
  if (loaded.includes(numericId)) return true;

  // Check database
  try {
    const db = await getDb();
    if ("exec" in db) {
      const res: any = await (db as any).exec(
        `SELECT draft_id FROM deleted_draft_tombstones WHERE draft_id = ${numericId} LIMIT 1;`
      );
      if (res && res.rows && res.rows.length > 0) {
        inMemoryTombstones.add(numericId);
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

export function getTombstonedDraftIds(): number[] {
  loadFileTombstones();
  return Array.from(inMemoryTombstones);
}
