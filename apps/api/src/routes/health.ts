import type { FastifyPluginAsync } from "fastify";

interface HealthResponse {
  status: "ok";
}

export const healthRoutes: FastifyPluginAsync = async (application) => {
  application.get<{ Reply: HealthResponse }>(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: {
              status: { type: "string", const: "ok" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );
};
