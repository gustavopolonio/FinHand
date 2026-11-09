import fastifyMultipart from "@fastify/multipart";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import { InputError } from "../../errors/application-errors.js";
import {
  cancelDocumentCaptureSession,
  captureTokenFromAuthorization,
  createDocumentCaptureSession,
  getAvailableDocumentCaptureSession,
  getDocumentCaptureSessionProgress,
  uploadDocumentForCaptureSession,
} from "../../services/document-capture-sessions.js";
import { maximumDocumentUploadBytes } from "../../services/document-uploads.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import { documentCaptureSessionParamsSchema } from "../../validation/document-capture-session-schemas.js";

interface DocumentCaptureSessionRoutesOptions {
  captureBaseUrl: string;
  documentStorage: DocumentStorage;
}

function createCaptureUrl(baseUrl: string, token: string): string {
  const captureUrl = new URL("/capture", baseUrl);
  captureUrl.hash = new URLSearchParams({ token }).toString();
  return captureUrl.toString();
}

export async function documentCaptureSessionRoutes(
  application: FastifyInstance,
  { captureBaseUrl, documentStorage }: DocumentCaptureSessionRoutesOptions,
) {
  await application.register(fastifyMultipart, {
    limits: {
      fields: 0,
      fileSize: maximumDocumentUploadBytes,
      files: 1,
      parts: 1,
    },
  });

  const captureApplication =
    application.withTypeProvider<ZodTypeProvider>();

  captureApplication.post(
    "/api/document-capture-sessions",
    { preHandler: application.requireAuthentication },
    async (request, reply) => {
      const session = await createDocumentCaptureSession(
        application.database,
        request.authenticatedUserId,
      );

      return reply.status(201).send({
        session: {
          id: session.id,
          status: session.status,
          expiresAt: session.expiresAt,
          captureUrl: createCaptureUrl(captureBaseUrl, session.token),
        },
      });
    },
  );

  captureApplication.get(
    "/api/document-capture-sessions/:id",
    {
      preHandler: application.requireAuthentication,
      schema: { params: documentCaptureSessionParamsSchema },
    },
    async (request) => {
      const session = await getDocumentCaptureSessionProgress(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { session };
    },
  );

  captureApplication.post(
    "/api/document-capture-sessions/:id/cancel",
    {
      preHandler: application.requireAuthentication,
      schema: { params: documentCaptureSessionParamsSchema },
    },
    async (request) => {
      const session = await cancelDocumentCaptureSession(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { session };
    },
  );

  captureApplication.get(
    "/api/document-capture-session",
    async (request) => {
      const token = captureTokenFromAuthorization(
        request.headers.authorization,
      );
      const session = await getAvailableDocumentCaptureSession(
        application.database,
        token,
      );

      return {
        session: {
          status: session.status,
          expiresAt: session.expiresAt,
          acceptedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
          ],
          maximumBytes: maximumDocumentUploadBytes,
        },
      };
    },
  );

  captureApplication.post(
    "/api/document-capture-session/document",
    async (request, reply) => {
      const token = captureTokenFromAuthorization(
        request.headers.authorization,
      );

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

      const upload = await uploadDocumentForCaptureSession({
        database: application.database,
        documentStorage,
        fileName: document.filename,
        mimeType: document.mimetype,
        source: document.file,
        token,
        wasTruncated: () => document.file.truncated,
      });

      return reply.status(201).send({ upload });
    },
  );
}
