import { EventEmitter } from "node:events";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  createPostgresUserEventListener,
  publishCaptureSessionChangedForUpload,
  publishUploadChanged,
  UserEventHub,
} from "./user-events.js";

const postgresDialect = new PgDialect();
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const uploadId = "33333333-3333-4333-8333-333333333333";
const captureSessionId = "44444444-4444-4444-8444-444444444444";

function createDatabaseFixture() {
  const execute = vi.fn().mockResolvedValue([]);

  return { database: { execute }, execute };
}

describe("realtime user events", () => {
  it("delivers an event only to subscribers for its user", () => {
    const hub = new UserEventHub();
    const subscriber = vi.fn();
    const otherSubscriber = vi.fn();

    hub.subscribe(userId, subscriber);
    hub.subscribe(otherUserId, otherSubscriber);
    hub.publish({ type: "upload.updated", userId, uploadId });

    expect(subscriber).toHaveBeenCalledWith({
      type: "upload.updated",
      uploadId,
    });
    expect(otherSubscriber).not.toHaveBeenCalled();
    expect(JSON.stringify(subscriber.mock.calls)).not.toContain(userId);
  });

  it("stops delivering events after a subscriber disconnects", () => {
    const hub = new UserEventHub();
    const subscriber = vi.fn();
    const unsubscribe = hub.subscribe(userId, subscriber);

    unsubscribe();
    hub.publish({
      type: "capture-session.updated",
      userId,
      uploadId,
      captureSessionId,
    });

    expect(subscriber).not.toHaveBeenCalled();
  });

  it("publishes an upload event using the upload owner from the database", async () => {
    const fixture = createDatabaseFixture();

    await publishUploadChanged(fixture.database, uploadId);

    const query = postgresDialect.sqlToQuery(
      fixture.execute.mock.calls[0]?.[0] as SQL,
    );
    expect(query.sql).toContain("pg_notify");
    expect(query.sql).toContain('from "uploads"');
    expect(query.sql).toContain('where "uploads"."id" = $2');
    expect(query.params).toEqual(["finhand_user_events", uploadId]);
  });

  it("publishes a capture event only for a session linked to the upload owner", async () => {
    const fixture = createDatabaseFixture();

    await publishCaptureSessionChangedForUpload(fixture.database, uploadId);

    const query = postgresDialect.sqlToQuery(
      fixture.execute.mock.calls[0]?.[0] as SQL,
    );
    expect(query.sql).toContain("pg_notify");
    expect(query.sql).toContain('inner join "uploads"');
    expect(query.sql).toContain(
      '"uploads"."user_id" = "document_capture_sessions"."user_id"',
    );
    expect(query.params).toEqual(["finhand_user_events", uploadId]);
  });

  it("listens for valid database notifications and releases its connection", async () => {
    const client = new EventEmitter() as EventEmitter & {
      query: ReturnType<typeof vi.fn>;
      release: ReturnType<typeof vi.fn>;
    };
    client.query = vi.fn().mockResolvedValue(undefined);
    client.release = vi.fn();
    const pool = {
      connect: vi.fn().mockResolvedValue(client as unknown as PoolClient),
    } as unknown as Pool;
    const onEvent = vi.fn();
    const logger = { error: vi.fn(), warn: vi.fn() };
    const listener = createPostgresUserEventListener(pool);

    await listener.start(onEvent, logger);
    client.emit("notification", {
      channel: "finhand_user_events",
      payload: JSON.stringify({ type: "upload.updated", userId, uploadId }),
      processId: 123,
    });
    client.emit("notification", {
      channel: "finhand_user_events",
      payload: "invalid-json",
      processId: 123,
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "upload.updated",
      userId,
      uploadId,
    });
    expect(logger.warn).toHaveBeenCalledOnce();

    await listener.close();
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      "LISTEN finhand_user_events",
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "UNLISTEN finhand_user_events",
    );
    expect(client.release).toHaveBeenCalledOnce();
  });
});
