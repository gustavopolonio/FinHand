import type { FastifyInstance } from "fastify";

import {
  type ClientUserEvent,
  UserEventHub,
} from "../../realtime/user-events.js";

const heartbeatIntervalMilliseconds = 25_000;
const maximumConnectionLifetimeMilliseconds = 15 * 60 * 1_000;

export function serializeServerSentEvent(event: ClientUserEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

interface UserEventRoutesOptions {
  eventHub: UserEventHub;
  heartbeatMilliseconds?: number;
  maximumLifetimeMilliseconds?: number;
}

export async function userEventRoutes(
  application: FastifyInstance,
  {
    eventHub,
    heartbeatMilliseconds = heartbeatIntervalMilliseconds,
    maximumLifetimeMilliseconds = maximumConnectionLifetimeMilliseconds,
  }: UserEventRoutesOptions,
) {
  application.get(
    "/api/events",
    { preHandler: application.requireAuthentication },
    async (request, reply) => {
      reply.hijack();
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      reply.raw.writeHead(200, {
        "Cache-Control": "private, no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write("retry: 5000\n\n");

      let isClosed = false;
      const close = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeat);
        clearTimeout(maximumLifetime);
        unsubscribe();
        if (!reply.raw.writableEnded) reply.raw.end();
      };
      const unsubscribe = eventHub.subscribe(
        request.authenticatedUserId,
        (event) => {
          if (!reply.raw.write(serializeServerSentEvent(event))) close();
        },
      );
      const heartbeat = setInterval(() => {
        if (!reply.raw.write(": heartbeat\n\n")) close();
      }, heartbeatMilliseconds);
      const maximumLifetime = setTimeout(close, maximumLifetimeMilliseconds);

      heartbeat.unref();
      maximumLifetime.unref();
      reply.raw.on("close", close);
    },
  );
}
