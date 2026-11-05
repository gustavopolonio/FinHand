import { DeleteObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMocks = vi.hoisted(() => ({
  done: vi.fn(),
  options: vi.fn(),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(function MockUpload(options: unknown) {
    uploadMocks.options(options);
    return { done: uploadMocks.done };
  }),
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
});

describe("createS3DocumentStorage", () => {
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
