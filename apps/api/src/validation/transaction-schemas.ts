import { z } from "zod/v4";

import { transactionTypes } from "../db/schema/index.js";

export const createTransactionBodySchema = z.strictObject({
  accountId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  type: z.enum(transactionTypes),
  amountMinor: z.string().regex(/^\d+$/).max(19),
  occurredOn: z.iso.date(),
  description: z.string().min(1).max(200),
  counterparty: z.string().max(200).nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
});

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
export type CreateTransactionInput = z.infer<
  typeof createTransactionBodySchema
>;
