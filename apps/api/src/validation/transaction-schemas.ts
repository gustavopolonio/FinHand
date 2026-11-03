import { z } from "zod/v4";

import { transactionTypes } from "../db/schema/index.js";

export const listTransactionsQuerySchema = z
  .strictObject({
    type: z.enum(transactionTypes).optional(),
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .default(0),
  })
  .refine(
    ({ from, to }) => from === undefined || to === undefined || from <= to,
    {
      message: "The end date must be on or after the start date.",
      path: ["to"],
    },
  );

export type ListTransactionsQuery = z.infer<
  typeof listTransactionsQuerySchema
>;
