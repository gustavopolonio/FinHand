import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { SupportedDocumentMimeType } from "../services/document-uploads.js";
import {
  transactionCandidateExtractionSchema,
  transactionCandidateFieldInstructions,
  type ExtractedTransactionCandidate,
} from "./transaction-candidate-extraction.js";

export type { ExtractedTransactionCandidate } from "./transaction-candidate-extraction.js";

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

Return an empty candidates array when the document does not represent a financial transaction. Do not invent a candidate merely because a document was provided.

For document extraction, return occurredOn only when the document contains a complete calendar date.

${transactionCandidateFieldInstructions}`;

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
            transactionCandidateExtractionSchema,
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
