import { z } from "zod/v4";

import { categoryTypes } from "../db/schema/index.js";

export const createCategoryBodySchema = z.strictObject({
  name: z.string().min(1).max(100),
  type: z.enum(categoryTypes),
});

export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
