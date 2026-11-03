import { z } from "zod/v4";

import { accountTypes } from "../db/schema/index.js";

const accountNameSchema = z.string().min(1).max(100);
const accountTypeSchema = z.enum(accountTypes);
const openingBalanceMinorSchema = z.string().regex(/^-?\d+$/);

export const accountParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const createAccountBodySchema = z.strictObject({
  name: accountNameSchema,
  type: accountTypeSchema,
  currencyCode: z.string().length(3).optional(),
  openingBalanceMinor: openingBalanceMinorSchema.optional(),
});

export const updateAccountBodySchema = z
  .strictObject({
    name: accountNameSchema.optional(),
    type: accountTypeSchema.optional(),
    openingBalanceMinor: openingBalanceMinorSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one account field is required.",
  });

export type CreateAccountInput = z.infer<typeof createAccountBodySchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountBodySchema>;
