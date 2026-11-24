import { describe, expect, it, vi } from "vitest";

import {
  type EventSourceLike,
  parseUserEvent,
  startUserEventStream,
} from "./user-events";

describe("user events", () => {
  it("accepts only supported event payloads", () => {
    expect(
      parseUserEvent(
        JSON.stringify({ type: "upload.updated", uploadId: "upload-id" }),
      ),
    ).toEqual({ type: "upload.updated", uploadId: "upload-id" });
    expect(
      parseUserEvent(
        JSON.stringify({
          type: "capture-session.updated",
          uploadId: "upload-id",
          captureSessionId: "session-id",
        }),
      ),
    ).toEqual({
      type: "capture-session.updated",
      uploadId: "upload-id",
      captureSessionId: "session-id",
    });
    expect(parseUserEvent("not json")).toBeNull();
    expect(
      parseUserEvent(JSON.stringify({ type: "upload.updated" })),
    ).toBeNull();
    expect(
      parseUserEvent(
        JSON.stringify({
          type: "upload.updated",
          uploadId: "upload-id",
          userId: "must-not-be-sent",
        }),
      ),
    ).toEqual({ type: "upload.updated", uploadId: "upload-id" });
  });

  it("opens one credentialed stream and closes it", () => {
    const close = vi.fn();
    const source: EventSourceLike = { close, onmessage: null, onopen: null };
    const createEventSource = vi.fn().mockReturnValue(source);
    const onEvent = vi.fn();
    const onOpen = vi.fn();
    const stream = startUserEventStream({
      createEventSource,
      onEvent,
      onOpen,
    });

    expect(createEventSource).toHaveBeenCalledWith(
      "http://localhost:3001/api/events",
    );
    source.onopen?.({} as Event);
    source.onmessage?.({
      data: JSON.stringify({ type: "upload.updated", uploadId: "upload-id" }),
    } as MessageEvent<string>);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: "upload.updated",
      uploadId: "upload-id",
    });

    stream.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
