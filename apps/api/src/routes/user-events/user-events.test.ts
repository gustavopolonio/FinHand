import fastifyCors from "@fastify/cors";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import { UserEventHub } from "../../realtime/user-events.js";
import { serializeServerSentEvent } from "./user-events.js";
import { userEventRoutes } from "./user-events.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("user event routes", () => {
  it("serializes an SSE message without user or financial data", () => {
    expect(
      serializeServerSentEvent({
        type: "capture-session.updated",
        uploadId: "upload-id",
        captureSessionId: "capture-session-id",
      }),
    ).toBe(
      'data: {"type":"capture-session.updated","uploadId":"upload-id","captureSessionId":"capture-session-id"}\n\n',
    );
  });

  it("streams only events belonging to the authenticated user", async () => {
    const application = Fastify();
    const eventHub = new UserEventHub();
    const authentication = {
      handler: async () => new Response(null, { status: 404 }),
      api: {
        getSession: async () => ({
          session: { id: "session-id" },
          user: { id: userId },
        }),
      },
    } as unknown as Authentication;
    registerAuthenticationGuard(application, authentication);
    application.register(fastifyCors, {
      origin: "http://localhost:3000",
      credentials: true,
    });
    application.register(userEventRoutes, {
      eventHub,
      heartbeatMilliseconds: 1_000,
      maximumLifetimeMilliseconds: 30,
    });
    applications.push(application);

    setTimeout(() => {
      eventHub.publish({
        type: "upload.updated",
        userId: otherUserId,
        uploadId: "33333333-3333-4333-8333-333333333333",
      });
      eventHub.publish({
        type: "upload.updated",
        userId,
        uploadId: "44444444-4444-4444-8444-444444444444",
      });
    }, 5);

    const response = await application.inject({
      headers: { origin: "http://localhost:3000" },
      method: "GET",
      url: "/api/events",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["cache-control"]).toBe(
      "private, no-cache, no-transform",
    );
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.body).toContain("retry: 5000");
    expect(response.body).toContain("44444444-4444-4444-8444-444444444444");
    expect(response.body).not.toContain(
      "33333333-3333-4333-8333-333333333333",
    );
    expect(response.body).not.toContain(userId);
  });
});
