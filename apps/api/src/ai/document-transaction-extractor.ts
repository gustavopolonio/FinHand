import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { SupportedDocumentMimeType } from "../services/document-uploads.js";

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

const extractionSchema = z.strictObject({
  candidates: z.array(extractedCandidateSchema).min(1).max(25),
});

export type ExtractedTransactionCandidate = z.infer<
  typeof extractedCandidateSchema
>;

export interface ExtractDocumentInput {
  content: Buffer;
  fileName: string;
  mimeType: SupportedDocumentMimeType;
}

export interface DocumentTransactionExtractor {
  extractDocument(
    input: ExtractDocumentInput,
  ): Promise<ExtractedTransactionCandidate[]>;
}

interface CreateOpenAiDocumentTransactionExtractorOptions {
  apiKey: string;
  client?: OpenAI;
  model: string;
}

const extractionInstructions = `You extract proposed financial transactions from receipts and invoices.

Return one candidate for each distinct financial transaction represented by the document. A normal itemized receipt is one transaction using its final paid total, not one transaction per line item. A document containing multiple independent receipts or invoices may produce multiple candidates.

Do not invent missing values. Use null and add a short warning when a field is missing or uncertain.

For amountMinor, return only a positive base-10 integer string in the currency's smallest unit. For example, BRL 42.90 is "4290". Never return a decimal or a negative value. Use income or expense to represent direction.

Use a three-letter uppercase ISO 4217 currency code when identifiable. Use YYYY-MM-DD for occurredOn only when a complete calendar date is present. Keep descriptions concise and put the merchant, payer, or payee in counterparty. Confidence values range from 0 to 1.`;

export function createOpenAiDocumentTransactionExtractor({
  apiKey,
  client = new OpenAI({ apiKey }),
  model,
}: CreateOpenAiDocumentTransactionExtractorOptions): DocumentTransactionExtractor {
  if (!apiKey.trim()) {
    throw new Error("An OpenAI API key is required.");
  }

  if (!model.trim()) {
    throw new Error("An OpenAI document model is required.");
  }

  return {
    async extractDocument({ content, fileName, mimeType }) {
      const encodedContent = content.toString("base64");
      const documentInput =
        mimeType === "application/pdf"
          ? {
              type: "input_file" as const,
              detail: "high" as const,
              filename: fileName,
              file_data: `data:${mimeType};base64,${encodedContent}`,
            }
          : {
              type: "input_image" as const,
              detail: "high" as const,
              image_url: `data:${mimeType};base64,${encodedContent}`,
            };

      const response = await client.responses.parse({
        model,
        reasoning: {
          effort: "low",
        },
        store: false,
        input: [
          {
            role: "system",
            content: extractionInstructions,
          },
          {
            role: "user",
            content: [
              documentInput,
              {
                type: "input_text",
                text:
                  "Extract the proposed transaction candidates from this document.",
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(
            extractionSchema,
            "document_transaction_candidates",
          ),
        },
      });

      if (!response.output_parsed) {
        throw new Error(
          "OpenAI did not return structured transaction candidates.",
        );
      }

      return response.output_parsed.candidates;
    },
  };
}
