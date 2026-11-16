import { z } from "zod";

const confidenceSchema = z.strictObject({
  type: z.number().min(0).max(1).nullable(),
  amountMinor: z.number().min(0).max(1).nullable(),
  currencyCode: z.number().min(0).max(1).nullable(),
  occurredOn: z.number().min(0).max(1).nullable(),
  description: z.number().min(0).max(1).nullable(),
  counterparty: z.number().min(0).max(1).nullable(),
});

const extractedCandidateSchema = z.strictObject({
  type: z.enum(["income", "expense"]).nullable(),
  amountMinor: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .nullable(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  description: z.string().nullable(),
  counterparty: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: confidenceSchema,
  warnings: z.array(z.string()).max(20),
});

export const transactionCandidateExtractionSchema = z.strictObject({
  candidates: z.array(extractedCandidateSchema).max(25),
});

export type ExtractedTransactionCandidate = z.infer<
  typeof extractedCandidateSchema
>;

export const transactionCandidateFieldInstructions = `Do not invent missing values. Use null and add a short warning when a field is missing, inferred, or uncertain.

For amountMinor, return only a positive base-10 integer string in the currency's smallest unit. For example, BRL 42.90 is "4290". Never return a decimal or a negative value. Use income or expense to represent direction.

Use a three-letter uppercase ISO 4217 currency code when identifiable. Use YYYY-MM-DD for occurredOn. Keep descriptions concise and put the merchant, payer, or payee in counterparty. Confidence values range from 0 to 1.`;
