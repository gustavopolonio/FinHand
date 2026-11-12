import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

export interface StoreDocumentInput {
  body: Readable;
  contentType: string;
  objectKey: string;
}

export interface DocumentStorage {
  close(): void;
  createDocumentPreviewUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string>;
  deleteDocument(objectKey: string): Promise<void>;
  readDocument(objectKey: string): Promise<Buffer>;
  storeDocument(input: StoreDocumentInput): Promise<void>;
}

interface S3DocumentStorageOptions {
  bucket: string;
  client?: S3Client;
  region: string;
}

export function createS3DocumentStorage(
  options: S3DocumentStorageOptions,
): DocumentStorage {
  const { bucket, region } = options;
  const client = options.client ?? new S3Client({ region });

  return {
    close() {
      client.destroy();
    },

    async createDocumentPreviewUrl(objectKey, expiresInSeconds) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ResponseContentDisposition: "inline",
        }),
        { expiresIn: expiresInSeconds },
      );
    },

    async deleteDocument(objectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    },

    async readDocument(objectKey) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );

      if (!response.Body) {
        throw new Error("Stored document has no content.");
      }

      return Buffer.from(await response.Body.transformToByteArray());
    },

    async storeDocument({ body, contentType, objectKey }) {
      const upload = new Upload({
        client,
        leavePartsOnError: false,
        params: {
          Body: body,
          Bucket: bucket,
          ContentType: contentType,
          Key: objectKey,
          ServerSideEncryption: "AES256",
        },
      });

      await upload.done();
    },
  };
}
