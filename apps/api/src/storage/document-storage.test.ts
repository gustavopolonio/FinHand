import {
  DeleteObjectCommand,
  GetObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  done: vi.fn(),
  options: vi.fn(),
}));
const presignerMocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(function MockUpload(options: unknown) {
    uploadMocks.options(options);
    return { done: uploadMocks.done };
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: presignerMocks.getSignedUrl,
}));

import { createS3DocumentStorage } from "./document-storage.js";

function createClient() {
  return {
    destroy: vi.fn(),
    send: vi.fn().mockResolvedValue({}),
  } as unknown as S3Client;
}

beforeEach(() => {
  uploadMocks.done.mockReset().mockResolvedValue({});
  uploadMocks.options.mockReset();
  presignerMocks.getSignedUrl
    .mockReset()
    .mockResolvedValue("https://signed.example/receipt");
});

describe("createS3DocumentStorage", () => {
  it("creates a short-lived inline URL for a private object", async () => {
    const client = createClient();
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });

    await expect(
      storage.createDocumentPreviewUrl("user/documents/upload-id", 300),
    ).resolves.toBe("https://signed.example/receipt");

    expect(presignerMocks.getSignedUrl).toHaveBeenCalledOnce();
    const [, command, options] = presignerMocks.getSignedUrl.mock.calls[0] ?? [];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: "finhand-test-uploads",
      Key: "user/documents/upload-id",
      ResponseContentDisposition: "inline",
    });
    expect(options).toEqual({ expiresIn: 300 });
  });

  it("uploads an encrypted private object to the configured bucket", async () => {
    const client = createClient();
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });
    const body = { pipe: vi.fn() };

    await storage.storeDocument({
      body: body as never,
      contentType: "application/pdf",
      objectKey: "user/documents/upload-id",
    });

    expect(uploadMocks.options).toHaveBeenCalledWith({
      client,
      leavePartsOnError: false,
      params: {
        Body: body,
        Bucket: "finhand-test-uploads",
        ContentType: "application/pdf",
        Key: "user/documents/upload-id",
        ServerSideEncryption: "AES256",
      },
    });
    expect(uploadMocks.done).toHaveBeenCalledOnce();
  });

  it("deletes an object during failed-upload cleanup", async () => {
    const client = createClient();
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });

    await storage.deleteDocument("user/documents/upload-id");

    const send = client.send as ReturnType<typeof vi.fn>;
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: "finhand-test-uploads",
      Key: "user/documents/upload-id",
    });
  });

  it("reads a private object for document processing", async () => {
    const content = Uint8Array.from([1, 2, 3]);
    const client = createClient();
    vi.mocked(client.send).mockResolvedValueOnce({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(content),
      },
    } as never);
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });

    await expect(
      storage.readDocument("user/documents/upload-id"),
    ).resolves.toEqual(Buffer.from(content));

    const send = client.send as ReturnType<typeof vi.fn>;
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: "finhand-test-uploads",
      Key: "user/documents/upload-id",
    });
  });

  it("rejects a stored object without a response body", async () => {
    const client = createClient();
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });

    await expect(
      storage.readDocument("user/documents/upload-id"),
    ).rejects.toThrow("Stored document has no content.");
  });

  it("destroys the S3 client when application storage closes", () => {
    const client = createClient();
    const storage = createS3DocumentStorage({
      bucket: "finhand-test-uploads",
      client,
      region: "sa-east-1",
    });

    storage.close();

    expect(client.destroy).toHaveBeenCalledOnce();
  });
});
