import { z } from "zod/v4";

export const documentUploadParamsSchema = z.strictObject({
  id: z.uuid(),
});
