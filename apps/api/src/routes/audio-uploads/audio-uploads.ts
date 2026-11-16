import fastifyMultipart from "@fastify/multipart";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import { InputError } from "../../errors/application-errors.js";
import { getAudioPreviewForUser } from "../../services/document-previews.js";
import {
  maximumAudioRecordingBytes,
  uploadAudioRecordingForUser,
} from "../../services/audio-uploads.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import { documentUploadParamsSchema } from "../../validation/document-upload-schemas.js";

interface AudioUploadRoutesOptions {
  documentStorage: DocumentStorage;
}

export async function audioUploadRoutes(
  application: FastifyInstance,
  { documentStorage }: AudioUploadRoutesOptions,
) {
  await application.register(fastifyMultipart, {
    limits: {
      fields: 0,
      fileSize: maximumAudioRecordingBytes,
      files: 1,
      parts: 1,
    },
  });

  application.addHook("preHandler", application.requireAuthentication);
  const uploadsApplication = application.withTypeProvider<ZodTypeProvider>();

  uploadsApplication.get(
    "/api/uploads/audio/:id/preview",
    { schema: { params: documentUploadParamsSchema } },
    async (request, reply) => {
      const preview = await getAudioPreviewForUser({
        database: application.database,
        documentStorage,
        uploadId: request.params.id,
        userId: request.authenticatedUserId,
      });

      return reply.header("Cache-Control", "private, no-store").send(preview);
    },
  );

  application.post("/api/uploads/audio", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new InputError(
        "Audio recording upload must use multipart/form-data.",
      );
    }

    const recording = await request.file();

    if (!recording) {
      throw new InputError("An audio recording is required.");
    }

    if (recording.fieldname !== "recording") {
      recording.file.resume();
      throw new InputError(
        'The uploaded audio must use the "recording" form field.',
      );
    }

    const upload = await uploadAudioRecordingForUser({
      database: application.database,
      documentStorage,
      fileName: recording.filename,
      mimeType: recording.mimetype,
      source: recording.file,
      wasTruncated: () => recording.file.truncated,
      userId: request.authenticatedUserId,
    });

    return reply.status(201).send({ upload });
  });
}
