import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { createOpenAiAudioTransactionExtractor } from "./audio-transaction-extractor.js";

const candidates = [
  {
    type: "expense" as const,
    amountMinor: "5000",
    currencyCode: "BRL",
    occurredOn: "2026-11-15",
    description: "Groceries",
    counterparty: "Market",
    notes: null,
    confidence: {
      type: 0.99,
      amountMinor: 0.98,
      currencyCode: 0.8,
      occurredOn: 0.9,
      description: 0.9,
      counterparty: 0.9,
    },
    warnings: ["Currency was inferred from the user default."],
  },
  {
    type: "income" as const,
    amountMinor: "500000",
    currencyCode: "BRL",
    occurredOn: "2026-11-16",
    description: "Salary",
    counterparty: null,
    notes: null,
    confidence: {
      type: 0.99,
      amountMinor: 0.98,
      currencyCode: 0.9,
      occurredOn: 0.8,
      description: 0.9,
      counterparty: null,
    },
    warnings: ["Date was inferred from the reference date."],
  },
];

function createClient(outputParsed: unknown = { candidates }) {
  const parse = vi.fn().mockResolvedValue({ output_parsed: outputParsed });
  const client = { responses: { parse } } as unknown as OpenAI;

  return { client, parse };
}

describe("OpenAI audio transaction extractor", () => {
  it("extracts multiple ordered candidates with user date and currency context", async () => {
    const { client, parse } = createClient();
    const extractor = createOpenAiAudioTransactionExtractor({
      apiKey: "test-api-key",
      client,
      model: "test-text-model",
    });
    const transcript =
      "Yesterday I spent fifty at Market, and today I received my salary of five thousand reais.";

    await expect(
      extractor.extractTranscript({
        defaultCurrency: "BRL",
        referenceDate: "2026-11-16",
        timeZone: "America/Sao_Paulo",
        transcript,
      }),
    ).resolves.toEqual(candidates);

    const request = parse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "test-text-model",
      reasoning: { effort: "low" },
      store: false,
      text: { format: expect.any(Object) },
    });
    expect(request.input[1].content[0].text).toContain(
      "Reference date: 2026-11-16",
    );
    expect(request.input[1].content[0].text).toContain(
      "Time zone: America/Sao_Paulo",
    );
    expect(request.input[1].content[0].text).toContain(
      "Default currency: BRL",
    );
    expect(request.input[1].content[0].text).toContain(transcript);
  });

  it("allows no candidates when speech contains no transaction", async () => {
    const { client } = createClient({ candidates: [] });
    const extractor = createOpenAiAudioTransactionExtractor({
      apiKey: "test-api-key",
      client,
      model: "test-text-model",
    });

    await expect(
      extractor.extractTranscript({
        defaultCurrency: "BRL",
        referenceDate: "2026-11-16",
        timeZone: "UTC",
        transcript: "Remember to buy groceries later.",
      }),
    ).resolves.toEqual([]);
  });

  it("rejects a response without structured candidates", async () => {
    const { client } = createClient(null);
    const extractor = createOpenAiAudioTransactionExtractor({
      apiKey: "test-api-key",
      client,
      model: "test-text-model",
    });

    await expect(
      extractor.extractTranscript({
        defaultCurrency: "BRL",
        referenceDate: "2026-11-16",
        timeZone: "UTC",
        transcript: "I spent ten reais.",
      }),
    ).rejects.toThrow(
      "OpenAI did not return structured audio transaction candidates.",
    );
  });

  it.each([
    {
      apiKey: "",
      model: "test-model",
      message: "An OpenAI API key is required.",
    },
    {
      apiKey: "test-key",
      model: "",
      message: "An OpenAI audio extraction model is required.",
    },
  ])("rejects invalid client configuration", ({ apiKey, message, model }) => {
    const { client } = createClient();

    expect(() =>
      createOpenAiAudioTransactionExtractor({ apiKey, client, model }),
    ).toThrow(message);
  });
});
