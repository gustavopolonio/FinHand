import { z } from "zod/v4";

import { transactionTypes } from "../db/schema/index.js";

export const listTransactionCandidatesQuerySchema = z.strictObject({
  uploadId: z.uuid(),
});

export const transactionCandidateParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const updateTransactionCandidateBodySchema = z
  .strictObject({
    accountId: z.uuid().nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
    type: z.enum(transactionTypes).nullable().optional(),
    amountMinor: z.string().regex(/^\d+$/).max(19).nullable().optional(),
    currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/).nullable().optional(),
    occurredOn: z.iso.date().nullable().optional(),
    description: z.string().max(200).nullable().optional(),
    counterparty: z.string().max(200).nullable().optional(),
    notes: z.string().max(2_000).nullable().optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    { message: "At least one transaction candidate field is required." },
  );

export const confirmTransactionCandidateBodySchema = z.strictObject({
  accountId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  type: z.enum(transactionTypes),
  amountMinor: z.string().regex(/^\d+$/).max(19),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/),
  occurredOn: z.iso.date(),
  description: z.string().min(1).max(200),
  counterparty: z.string().max(200).nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
});

export type ListTransactionCandidatesQuery = z.infer<
  typeof listTransactionCandidatesQuerySchema
>;
export type ConfirmTransactionCandidateInput = z.infer<
  typeof confirmTransactionCandidateBodySchema
>;
export type UpdateTransactionCandidateInput = z.infer<
  typeof updateTransactionCandidateBodySchema
>;
