import type { Notification, Pool, PoolClient } from "pg";
import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../db/index.js";
import { documentCaptureSessions, uploads } from "../db/schema/index.js";

export const userEventsChannel = "finhand_user_events";

const uploadChangedEventSchema = z.strictObject({
  type: z.literal("upload.updated"),
  userId: z.uuid(),
  uploadId: z.uuid(),
});
const captureSessionChangedEventSchema = z.strictObject({
  type: z.literal("capture-session.updated"),
  userId: z.uuid(),
  uploadId: z.uuid(),
  captureSessionId: z.uuid(),
});
const userEventSchema = z.discriminatedUnion("type", [
  uploadChangedEventSchema,
  captureSessionChangedEventSchema,
]);

export type UserEvent = z.infer<typeof userEventSchema>;
export type ClientUserEvent =
  | Omit<z.infer<typeof uploadChangedEventSchema>, "userId">
  | Omit<z.infer<typeof captureSessionChangedEventSchema>, "userId">;

type EventDatabase = Pick<Database, "execute">;

export async function publishUploadChanged(
  database: EventDatabase,
  uploadId: string,
): Promise<void> {
  await database.execute(sql`
    select pg_notify(
      ${userEventsChannel},
      json_build_object(
        'type', 'upload.updated',
        'userId', ${uploads.userId},
        'uploadId', ${uploads.id}
      )::text
    )
    from ${uploads}
    where ${uploads.id} = ${uploadId}
  `);
}

export async function publishCaptureSessionChangedForUpload(
  database: EventDatabase,
  uploadId: string,
): Promise<void> {
  await database.execute(sql`
    select pg_notify(
      ${userEventsChannel},
      json_build_object(
        'type', 'capture-session.updated',
        'userId', ${documentCaptureSessions.userId},
        'uploadId', ${uploads.id},
        'captureSessionId', ${documentCaptureSessions.id}
      )::text
    )
    from ${documentCaptureSessions}
    inner join ${uploads}
      on ${uploads.id} = ${documentCaptureSessions.uploadId}
      and ${uploads.userId} = ${documentCaptureSessions.userId}
    where ${uploads.id} = ${uploadId}
  `);
}

export interface UserEventListenerLogger {
  error(context: { err: unknown; event: string }, message: string): void;
  warn(context: { event: string }, message: string): void;
}

export interface UserEventListener {
  close(): Promise<void>;
  start(
    onEvent: (event: UserEvent) => void,
    logger: UserEventListenerLogger,
  ): Promise<void>;
}

export function createNoopUserEventListener(): UserEventListener {
  return {
    async close() {},
    async start() {},
  };
}

export function createPostgresUserEventListener(
  pool: Pool,
  reconnectDelayMilliseconds = 1_000,
): UserEventListener {
  let client: PoolClient | null = null;
  let connectPromise: Promise<void> | null = null;
  let isClosed = false;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let eventHandler: ((event: UserEvent) => void) | null = null;
  let activeLogger: UserEventListenerLogger | null = null;

  function handleNotification(notification: Notification) {
    if (
      notification.channel !== userEventsChannel ||
      !notification.payload ||
      !eventHandler
    ) {
      return;
    }

    try {
      const event = userEventSchema.parse(JSON.parse(notification.payload));
      eventHandler(event);
    } catch {
      activeLogger?.warn(
        { event: "realtime.user-event.invalid" },
        "Ignored an invalid realtime user event",
      );
    }
  }

  function detachClient(activeClient: PoolClient, destroy: boolean) {
    activeClient.off("notification", handleNotification);
    activeClient.off("error", handleConnectionError);

    if (client === activeClient) {
      client = null;
    }

    activeClient.release(destroy);
  }

  function scheduleReconnect() {
    if (isClosed || reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, reconnectDelayMilliseconds);
    reconnectTimer.unref();
  }

  function handleConnectionError(error: Error) {
    const failedClient = client;

    activeLogger?.error(
      { err: error, event: "realtime.user-event.listener.disconnected" },
      "Realtime database listener disconnected",
    );

    if (failedClient) detachClient(failedClient, true);
    scheduleReconnect();
  }

  async function connect(): Promise<void> {
    if (isClosed || client || connectPromise) return connectPromise ?? undefined;

    connectPromise = (async () => {
      let nextClient: PoolClient | null = null;

      try {
        nextClient = await pool.connect();

        if (isClosed) {
          nextClient.release();
          return;
        }

        client = nextClient;
        nextClient.on("notification", handleNotification);
        nextClient.on("error", handleConnectionError);
        await nextClient.query(`LISTEN ${userEventsChannel}`);
      } catch (error) {
        if (nextClient) detachClient(nextClient, true);
        activeLogger?.error(
          { err: error, event: "realtime.user-event.listener.connect.failed" },
          "Failed to connect realtime database listener",
        );
        scheduleReconnect();
      } finally {
        connectPromise = null;
      }
    })();

    return connectPromise;
  }

  return {
    async start(onEvent, logger) {
      eventHandler = onEvent;
      activeLogger = logger;
      isClosed = false;
      await connect();
    },
    async close() {
      isClosed = true;
      eventHandler = null;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }

      await connectPromise;

      const activeClient = client;
      if (!activeClient) return;

      activeClient.off("error", handleConnectionError);
      activeClient.off("notification", handleNotification);
      client = null;

      try {
        await activeClient.query(`UNLISTEN ${userEventsChannel}`);
        activeClient.release();
      } catch {
        activeClient.release(true);
      }
    },
  };
}

type ClientEventHandler = (event: ClientUserEvent) => void;

export class UserEventHub {
  readonly #subscribers = new Map<string, Set<ClientEventHandler>>();

  publish(event: UserEvent): void {
    const { userId, ...clientEvent } = event;

    for (const subscriber of this.#subscribers.get(userId) ?? []) {
      subscriber(clientEvent as ClientUserEvent);
    }
  }

  subscribe(userId: string, subscriber: ClientEventHandler): () => void {
    const userSubscribers = this.#subscribers.get(userId) ?? new Set();
    userSubscribers.add(subscriber);
    this.#subscribers.set(userId, userSubscribers);

    return () => {
      userSubscribers.delete(subscriber);
      if (userSubscribers.size === 0) this.#subscribers.delete(userId);
    };
  }
}
