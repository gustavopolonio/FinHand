import { z } from "zod/v4";

import { categoryTypes } from "../db/schema/index.js";

export const createCategoryBodySchema = z.strictObject({
  name: z.string().min(1).max(100),
  type: z.enum(categoryTypes),
});

export const categoryParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const renameCategoryBodySchema = z.strictObject({
  name: z.string().min(1).max(100),
});

export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
export type RenameCategoryInput = z.infer<typeof renameCategoryBodySchema>;
