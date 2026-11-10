import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { createOpenAiDocumentTransactionExtractor } from "./document-transaction-extractor.js";

const candidate = {
  type: "expense" as const,
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  confidence: {
    type: 0.99,
    amountMinor: 0.95,
    currencyCode: 0.9,
    occurredOn: 0.85,
    description: 0.8,
    counterparty: 0.9,
  },
  warnings: [],
};

function createClient(outputParsed: unknown = { candidates: [candidate] }) {
  const parse = vi.fn().mockResolvedValue({ output_parsed: outputParsed });
  const client = {
    responses: { parse },
  } as unknown as OpenAI;

  return { client, parse };
}

describe("OpenAI document transaction extractor", () => {
  it("sends a PDF as a private file input and returns parsed candidates", async () => {
    const { client, parse } = createClient();
    const extractor = createOpenAiDocumentTransactionExtractor({
      apiKey: "test-api-key",
      client,
      model: "test-vision-model",
    });
    const content = Buffer.from("%PDF-receipt");

    await expect(
      extractor.extractDocument({
        content,
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
      }),
    ).resolves.toEqual([candidate]);

    const request = parse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "test-vision-model",
      reasoning: { effort: "low" },
      store: false,
      text: { format: expect.any(Object) },
    });
    expect(request.input[1].content[0]).toEqual({
      type: "input_file",
      detail: "high",
      filename: "receipt.pdf",
      file_data: `data:application/pdf;base64,${content.toString("base64")}`,
    });
  });

  it.each(["image/jpeg", "image/png"] as const)(
    "sends a %s document as an image input",
    async (mimeType) => {
      const { client, parse } = createClient();
      const extractor = createOpenAiDocumentTransactionExtractor({
        apiKey: "test-api-key",
        client,
        model: "test-vision-model",
      });
      const content = Buffer.from("receipt-image");

      await extractor.extractDocument({
        content,
        fileName: "receipt",
        mimeType,
      });

      expect(parse.mock.calls[0]?.[0].input[1].content[0]).toEqual({
        type: "input_image",
        detail: "high",
        image_url: `data:${mimeType};base64,${content.toString("base64")}`,
      });
    },
  );

  it("rejects a response without parsed candidates", async () => {
    const { client } = createClient(null);
    const extractor = createOpenAiDocumentTransactionExtractor({
      apiKey: "test-api-key",
      client,
      model: "test-vision-model",
    });

    await expect(
      extractor.extractDocument({
        content: Buffer.from("%PDF-receipt"),
        fileName: "receipt.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(
      "OpenAI did not return structured transaction candidates.",
    );
  });

  it.each([
    { apiKey: "", model: "test-model", message: "An OpenAI API key is required." },
    { apiKey: "test-key", model: "", message: "An OpenAI document model is required." },
  ])("rejects invalid client configuration", ({ apiKey, message, model }) => {
    const { client } = createClient();

    expect(() =>
      createOpenAiDocumentTransactionExtractor({ apiKey, client, model }),
    ).toThrow(message);
  });
});
