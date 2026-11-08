import { z } from "zod";

export const documentCaptureSessionParamsSchema = z.strictObject({
  id: z.uuid(),
});
