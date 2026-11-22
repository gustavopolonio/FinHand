import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  createApplicationLogger,
  redactedLogValue,
} from "./logger.js";

function createLogDestination(entries: Record<string, unknown>[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
}

describe("application logger", () => {
  it("writes structured service context and filters messages below its level", () => {
    const entries: Record<string, unknown>[] = [];
    const logger = createApplicationLogger(
      { environment: "test", level: "info", service: "api" },
      createLogDestination(entries),
    );

    logger.debug({ event: "ignored" }, "Ignored debug event");
    logger.info({ event: "api.ready" }, "API is ready");
    logger.flush();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      environment: "test",
      event: "api.ready",
      level: "info",
      message: "API is ready",
      service: "api",
    });
    expect(entries[0]?.time).toEqual(expect.any(String));
  });

  it("redacts credentials, request bodies, and financial-sensitive values", () => {
    const entries: Record<string, unknown>[] = [];
    const logger = createApplicationLogger(
      { environment: "test", level: "info", service: "worker" },
      createLogDestination(entries),
    );

    logger.info(
      {
        amount: "12345",
        context: {
          apiKey: "openai-secret",
          merchant: "private merchant",
          transcript: "private transcript",
        },
        headers: {
          authorization: "Bearer oauth-secret",
          cookie: "session=private-cookie",
        },
        request: {
          body: { password: "private-password" },
        },
      },
      "Sensitive values are protected",
    );
    logger.flush();

    expect(entries[0]).toMatchObject({
      amount: redactedLogValue,
      context: {
        apiKey: redactedLogValue,
        merchant: redactedLogValue,
        transcript: redactedLogValue,
      },
      headers: {
        authorization: redactedLogValue,
        cookie: redactedLogValue,
      },
      request: { body: redactedLogValue },
    });
    expect(JSON.stringify(entries[0])).not.toMatch(
      /12345|openai-secret|private merchant|private transcript|oauth-secret|private-cookie|private-password/,
    );
  });

  it("serializes errors without exposing their messages", () => {
    const entries: Record<string, unknown>[] = [];
    const logger = createApplicationLogger(
      { environment: "test", level: "info", service: "worker" },
      createLogDestination(entries),
    );
    const error = Object.assign(
      new TypeError("provider returned customer-secret\nsecond-secret-line"),
      { code: "PROVIDER_FAILURE" },
    );

    logger.error(
      { err: error, event: "provider.request.failed" },
      "Provider request failed",
    );
    logger.flush();

    expect(entries[0]).toMatchObject({
      err: {
        code: "PROVIDER_FAILURE",
        type: "TypeError",
      },
      event: "provider.request.failed",
      level: "error",
      message: "Provider request failed",
    });
    expect(JSON.stringify(entries[0])).not.toContain("customer-secret");
    expect(JSON.stringify(entries[0])).not.toContain("second-secret-line");
  });
});
