import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";

const serviceMocks = vi.hoisted(() => ({
  getAudioPreviewForUser: vi.fn(),
  uploadAudioRecordingForUser: vi.fn(),
}));

vi.mock("../../services/audio-uploads.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/audio-uploads.js")>()),
  uploadAudioRecordingForUser: serviceMocks.uploadAudioRecordingForUser,
}));

vi.mock("../../services/document-previews.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../services/document-previews.js")
  >()),
  getAudioPreviewForUser: serviceMocks.getAudioPreviewForUser,
}));

import { audioUploadRoutes } from "./audio-uploads.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";
const uploadedAudio = {
  id: "44444444-4444-4444-8444-444444444444",
  originalFileName: "voice-recording.webm",
  mimeType: "audio/webm" as const,
  byteSize: "8",
  checksumSha256: "a".repeat(64),
  durationSeconds: 4.2,
  status: "uploaded" as const,
  createdAt: "2026-11-16T12:00:00.000Z",
  updatedAt: "2026-11-16T12:00:01.000Z",
};

function createAuthentication(authenticatedUserId: string | null) {
  return {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () =>
        authenticatedUserId
          ? {
              session: { id: "session-id" },
              user: { id: authenticatedUserId },
            }
          : null,
    },
  } as unknown as Authentication;
}

function createStorage(): DocumentStorage {
  return {
    close: vi.fn(),
    createDocumentPreviewUrl: vi.fn(),
    deleteDocument: vi.fn(),
    readDocument: vi.fn(),
    storeDocument: vi.fn(),
  };
}

function createApplication(authenticatedUserId: string | null) {
  const application = Fastify();
  const documentStorage = createStorage();

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", {} as Database);
  registerAuthenticationGuard(
    application,
    createAuthentication(authenticatedUserId),
  );
  application.register(audioUploadRoutes, { documentStorage });
  applications.push(application);

  return { application, documentStorage };
}

function createMultipartPayload(options: {
  fieldName?: string;
  fileName?: string;
  mimeType?: string;
} = {}) {
  const boundary = "finhand-audio-test-boundary";
  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${options.fieldName ?? "recording"}"; filename="${options.fileName ?? "voice-recording.webm"}"\r\n` +
      `Content-Type: ${options.mimeType ?? "audio/webm;codecs=opus"}\r\n\r\n`,
  );
  const content = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([header, content, footer]),
  };
}

function createEmptyMultipartPayload() {
  const boundary = "finhand-empty-audio-boundary";

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.from(`--${boundary}--\r\n`),
  };
}

afterEach(async () => {
  serviceMocks.getAudioPreviewForUser.mockReset();
  serviceMocks.uploadAudioRecordingForUser.mockReset();
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("GET /api/uploads/audio/:id/preview", () => {
  it("returns a non-cacheable private audio preview", async () => {
    const { application, documentStorage } = createApplication(userId);
    serviceMocks.getAudioPreviewForUser.mockResolvedValue({
      url: "https://signed.example/recording",
      contentType: "audio/webm",
      expiresAt: "2026-11-16T12:05:00.000Z",
    });

    const response = await application.inject({
      method: "GET",
      url: `/api/uploads/audio/${uploadedAudio.id}/preview`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toEqual({
      url: "https://signed.example/recording",
      contentType: "audio/webm",
      expiresAt: "2026-11-16T12:05:00.000Z",
    });
    expect(serviceMocks.getAudioPreviewForUser).toHaveBeenCalledWith({
      database: application.database,
      documentStorage,
      uploadId: uploadedAudio.id,
      userId,
    });
  });

  it("requires authentication", async () => {
    const { application } = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: `/api/uploads/audio/${uploadedAudio.id}/preview`,
    });

    expect(response.statusCode).toBe(401);
    expect(serviceMocks.getAudioPreviewForUser).not.toHaveBeenCalled();
  });

  it("validates the upload identifier", async () => {
    const { application } = createApplication(userId);

    const response = await application.inject({
      method: "GET",
      url: "/api/uploads/audio/not-a-uuid/preview",
    });

    expect(response.statusCode).toBe(400);
    expect(serviceMocks.getAudioPreviewForUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/uploads/audio", () => {
  it("rejects an unauthenticated request before reading a recording", async () => {
    const { application } = createApplication(null);

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/audio",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(serviceMocks.uploadAudioRecordingForUser).not.toHaveBeenCalled();
  });

  it("requires multipart form data", async () => {
    const { application } = createApplication(userId);

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/audio",
      payload: { recording: "not audio" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Audio recording upload must use multipart/form-data.",
    });
  });

  it("requires one recording", async () => {
    const { application } = createApplication(userId);
    const multipart = createEmptyMultipartPayload();

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/audio",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "An audio recording is required.",
    });
  });

  it("requires the recording form field", async () => {
    const { application } = createApplication(userId);
    const multipart = createMultipartPayload({ fieldName: "audio" });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/audio",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'The uploaded audio must use the "recording" form field.',
    });
    expect(serviceMocks.uploadAudioRecordingForUser).not.toHaveBeenCalled();
  });

  it("uploads a recording for the authenticated user", async () => {
    const { application, documentStorage } = createApplication(userId);
    serviceMocks.uploadAudioRecordingForUser.mockImplementation(
      async ({ source }) => {
        for await (const _chunk of source) {
          // Consume the multipart stream as the real service does.
        }

        return uploadedAudio;
      },
    );
    const multipart = createMultipartPayload();

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/audio",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ upload: uploadedAudio });
    expect(serviceMocks.uploadAudioRecordingForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        database: application.database,
        documentStorage,
        fileName: "voice-recording.webm",
        mimeType: "audio/webm",
        userId,
        source: expect.anything(),
        wasTruncated: expect.any(Function),
      }),
    );
  });
});
