import fastifyMultipart from "@fastify/multipart";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import { InputError } from "../../errors/application-errors.js";
import { getDocumentPreviewForUser } from "../../services/document-previews.js";
import { retryFailedDocumentUploadForUser } from "../../services/document-retries.js";
import {
  maximumDocumentUploadBytes,
  uploadDocumentForUser,
} from "../../services/document-uploads.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import { documentUploadParamsSchema } from "../../validation/document-upload-schemas.js";

interface DocumentUploadRoutesOptions {
  documentStorage: DocumentStorage;
}

export async function documentUploadRoutes(
  application: FastifyInstance,
  { documentStorage }: DocumentUploadRoutesOptions,
) {
  await application.register(fastifyMultipart, {
    limits: {
      fields: 0,
      fileSize: maximumDocumentUploadBytes,
      files: 1,
      parts: 1,
    },
  });

  application.addHook("preHandler", application.requireAuthentication);
  const uploadsApplication = application.withTypeProvider<ZodTypeProvider>();

  uploadsApplication.get(
    "/api/uploads/documents/:id/preview",
    { schema: { params: documentUploadParamsSchema } },
    async (request, reply) => {
      const preview = await getDocumentPreviewForUser({
        database: application.database,
        documentStorage,
        uploadId: request.params.id,
        userId: request.authenticatedUserId,
      });

      return reply.header("Cache-Control", "private, no-store").send(preview);
    },
  );

  uploadsApplication.post(
    "/api/uploads/documents/:id/retry",
    { schema: { params: documentUploadParamsSchema } },
    async (request) => {
      const upload = await retryFailedDocumentUploadForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { upload };
    },
  );

  application.post("/api/uploads/documents", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new InputError(
        "Document upload must use multipart/form-data.",
      );
    }

    const document = await request.file();

    if (!document) {
      throw new InputError("A document file is required.");
    }

    if (document.fieldname !== "document") {
      document.file.resume();
      throw new InputError(
        'The uploaded file must use the "document" form field.',
      );
    }

    const upload = await uploadDocumentForUser({
      database: application.database,
      documentStorage,
      fileName: document.filename,
      mimeType: document.mimetype,
      source: document.file,
      wasTruncated: () => document.file.truncated,
      userId: request.authenticatedUserId,
    });

    return reply.status(201).send({ upload });
  });
}
