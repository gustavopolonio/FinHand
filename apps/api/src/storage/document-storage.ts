import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

export interface StoreDocumentInput {
  body: Readable;
  contentType: string;
  objectKey: string;
}

export interface DocumentStorage {
  close(): void;
  deleteDocument(objectKey: string): Promise<void>;
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

    async deleteDocument(objectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
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
