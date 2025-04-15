import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import { getDyadAppPath, getUserDataPath } from "../paths/paths";
import { eq } from "drizzle-orm";

// Database connection factory
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get the database path based on the current environment
 */
export function getDatabasePath(): string {
  return path.join(getUserDataPath(), "sqlite.db");
}

/**
 * Initialize the database connection
 */
export function initializeDatabase(): BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
} {
  if (_db) return _db as any;

  const dbPath = getDatabasePath();
  console.log("Initializing database at:", dbPath);

  // Check if the database file exists and remove it if it has issues
  try {
    // If the file exists but is empty or corrupted, it might cause issues
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      // If the file is very small, it might be corrupted
      if (stats.size < 100) {
        console.log(
          "Database file exists but may be corrupted. Removing it..."
        );
        fs.unlinkSync(dbPath);
      }
    }
  } catch (error) {
    console.error("Error checking database file:", error);
  }

  fs.mkdirSync(getUserDataPath(), { recursive: true });
  // Just a convenient time to create it.
  fs.mkdirSync(getDyadAppPath("."), { recursive: true });

  // Open the database with a higher timeout
  const sqlite = new Database(dbPath, { timeout: 10000 });

  // Enable foreign key constraints
  sqlite.pragma("foreign_keys = ON");

  // Create DB instance with schema
  _db = drizzle(sqlite, { schema });

  try {
    // Run migrations programmatically

    const migrationsFolder = path.join(__dirname, "..", "..", "drizzle");

    console.log("MIGRATIONS FOLDER INITIALIZE", migrationsFolder);

    // Verify migrations folder exists
    if (!fs.existsSync(migrationsFolder)) {
      console.error("Migrations folder not found:", migrationsFolder);
    } else {
      console.log("Running migrations from:", migrationsFolder);
      migrate(_db, { migrationsFolder });
    }
  } catch (error) {
    console.error("Migration error:", error);
  }

  return _db as any;
}

// Initialize database on import
try {
  initializeDatabase();
} catch (error) {
  console.error("Failed to initialize database:", error);
}

export const db = _db as any as BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

export async function updateAppGithubRepo(
  appId: number,
  org: string,
  repo: string
): Promise<void> {
  await db
    .update(schema.apps)
    .set({ githubOrg: org, githubRepo: repo })
    .where(eq(schema.apps.id, appId));
}
