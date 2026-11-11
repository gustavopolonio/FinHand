import type { FastifyInstance } from "fastify";

import { listOpenDocumentReviewsForUser } from "../../services/document-reviews.js";

export async function documentReviewRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);

  application.get("/api/document-reviews", async (request) => {
    const reviews = await listOpenDocumentReviewsForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { reviews };
  });
}
