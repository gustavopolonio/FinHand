import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "../../src/db/index.js";
import { executeDatabaseMigrations } from "../../src/db/migrations.js";
import { createTestDatabase } from "./database.js";

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function createDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

let firstConnection: DatabaseConnection;
let secondConnection: DatabaseConnection;

beforeAll(() => {
  firstConnection = createTestDatabase();
  secondConnection = createTestDatabase();
});

afterAll(async () => {
  await Promise.all([
    firstConnection.pool.end(),
    secondConnection.pool.end(),
  ]);
});

describe("database migration advisory lock", () => {
  it("rejects a concurrent migration and releases the lock afterward", async () => {
    const migrationStarted = createDeferred();
    const finishMigration = createDeferred();
    const firstMigrator = vi.fn(async () => {
      migrationStarted.resolve();
      await finishMigration.promise;
    });
    const secondMigrator = vi.fn(async () => {});

    const firstMigration = executeDatabaseMigrations(
      firstConnection,
      firstMigrator,
    );
    await migrationStarted.promise;

    await expect(
      executeDatabaseMigrations(secondConnection, secondMigrator),
    ).rejects.toThrow("Another database migration is already running.");
    expect(secondMigrator).not.toHaveBeenCalled();

    finishMigration.resolve();
    await firstMigration;

    await expect(
      executeDatabaseMigrations(secondConnection, secondMigrator),
    ).resolves.toBeUndefined();
    expect(firstMigrator).toHaveBeenCalledOnce();
    expect(secondMigrator).toHaveBeenCalledOnce();
  });
});
