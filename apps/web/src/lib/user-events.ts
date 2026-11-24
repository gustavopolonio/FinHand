import { apiUrl } from "./config";

export type UserEvent =
  | { type: "upload.updated"; uploadId: string }
  | {
      type: "capture-session.updated";
      uploadId: string;
      captureSessionId: string;
    };

export interface EventSourceLike {
  close(): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onopen: ((event: Event) => void) | null;
}

interface StartUserEventStreamOptions {
  createEventSource?: (url: string) => EventSourceLike;
  onEvent: (event: UserEvent) => void;
  onOpen: () => void;
}

export function parseUserEvent(value: string): UserEvent | null {
  try {
    const event = JSON.parse(value) as Record<string, unknown>;

    if (event.type === "upload.updated" && typeof event.uploadId === "string") {
      return { type: event.type, uploadId: event.uploadId };
    }

    if (
      event.type === "capture-session.updated" &&
      typeof event.uploadId === "string" &&
      typeof event.captureSessionId === "string"
    ) {
      return {
        type: event.type,
        uploadId: event.uploadId,
        captureSessionId: event.captureSessionId,
      };
    }
  } catch {
    // Invalid realtime events are ignored; normal API reads remain authoritative.
  }

  return null;
}

export function startUserEventStream({
  createEventSource = (url) =>
    new EventSource(url, { withCredentials: true }),
  onEvent,
  onOpen,
}: StartUserEventStreamOptions) {
  const eventSource = createEventSource(`${apiUrl}/api/events`);

  eventSource.onopen = () => onOpen();
  eventSource.onmessage = (message) => {
    const event = parseUserEvent(message.data);
    if (event) onEvent(event);
  };

  return {
    close() {
      eventSource.close();
    },
  };
}
