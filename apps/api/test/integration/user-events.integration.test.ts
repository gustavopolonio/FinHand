import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "../../src/db/index.js";
import {
  createPostgresUserEventListener,
  type UserEvent,
  userEventsChannel,
} from "../../src/realtime/user-events.js";
import { createTestDatabase } from "./database.js";

let connection: DatabaseConnection;

beforeAll(() => {
  connection = createTestDatabase();
});

afterAll(async () => {
  await connection.pool.end();
});

describe("PostgreSQL realtime user events", () => {
  it("delivers a notification published by another database connection", async () => {
    const listener = createPostgresUserEventListener(connection.pool);
    const userId = randomUUID();
    const uploadId = randomUUID();
    const expectedEvent: UserEvent = {
      type: "upload.updated",
      userId,
      uploadId,
    };
    let resolveEvent!: (event: UserEvent) => void;
    const receivedEvent = new Promise<UserEvent>((resolve) => {
      resolveEvent = resolve;
    });

    try {
      await listener.start(resolveEvent, { error: vi.fn(), warn: vi.fn() });
      await connection.database.execute(sql`
        select pg_notify(
          ${userEventsChannel},
          ${JSON.stringify(expectedEvent)}
        )
      `);

      await expect(receivedEvent).resolves.toEqual(expectedEvent);
    } finally {
      await listener.close();
    }
  });
});
