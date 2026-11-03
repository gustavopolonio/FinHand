import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod/v4";

const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export const healthRoutes: FastifyPluginAsync = async (application) => {
  application.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({ status: "ok" as const }),
  );
};
