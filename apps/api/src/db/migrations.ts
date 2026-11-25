import type { Database, DatabaseConnection } from "./index.js";

// 0x46484e44 spells "FHND" and namespaces this application-level lock.
const migrationLockNamespace = 0x46484e44;
const migrationLockIdentifier = 1;

type DatabaseMigrator = (database: Database) => Promise<void>;

export async function executeDatabaseMigrations(
  { database, pool }: DatabaseConnection,
  migrateDatabase: DatabaseMigrator,
): Promise<void> {
  const lockClient = await pool.connect();
  let lockAcquired = false;

  try {
    const result = await lockClient.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock($1, $2) as acquired",
      [migrationLockNamespace, migrationLockIdentifier],
    );
    lockAcquired = result.rows[0]?.acquired === true;

    if (!lockAcquired) {
      throw new Error("Another database migration is already running.");
    }

    await migrateDatabase(database);
  } finally {
    try {
      if (lockAcquired) {
        await lockClient.query(
          "select pg_advisory_unlock($1, $2)",
          [migrationLockNamespace, migrationLockIdentifier],
        );
      }
    } finally {
      lockClient.release();
    }
  }
}
