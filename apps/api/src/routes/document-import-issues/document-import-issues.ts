import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  dismissDocumentImportIssueForUser,
  listDocumentImportIssuesForUser,
} from "../../services/document-import-issues.js";
import { documentUploadParamsSchema } from "../../validation/document-upload-schemas.js";

export async function documentImportIssueRoutes(
  application: FastifyInstance,
) {
  application.addHook("preHandler", application.requireAuthentication);
  const issuesApplication = application.withTypeProvider<ZodTypeProvider>();

  issuesApplication.get("/api/document-import-issues", async (request) => {
    const issues = await listDocumentImportIssuesForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { issues };
  });

  issuesApplication.post(
    "/api/uploads/documents/:id/dismiss-failure",
    { schema: { params: documentUploadParamsSchema } },
    async (request) => {
      const issue = await dismissDocumentImportIssueForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { issue };
    },
  );
}
