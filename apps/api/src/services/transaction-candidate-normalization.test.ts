import { describe, expect, it } from "vitest";

import type { ExtractedTransactionCandidate } from "../ai/document-transaction-extractor.js";
import { normalizeExtractedTransactionCandidates } from "./transaction-candidate-normalization.js";

function createCandidate(
  overrides: Partial<ExtractedTransactionCandidate> = {},
): ExtractedTransactionCandidate {
  return {
    type: "expense",
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
    ...overrides,
  };
}

describe("transaction candidate normalization", () => {
  it("normalizes financial fields and user-facing text without floating-point arithmetic", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        amountMinor: " 004290 ",
        currencyCode: " brl ",
        occurredOn: " 2026-11-10 ",
        description: "  Weekly   groceries\n purchase ",
        counterparty: " Example\tMarket ",
        notes: " Paid   with card ",
        warnings: ["  Total was   slightly blurred.  "],
      }),
    ]);

    expect(result).toEqual({
      candidates: [
        {
          type: "expense",
          amountMinor: 4290n,
          currencyCode: "BRL",
          occurredOn: "2026-11-10",
          description: "Weekly groceries purchase",
          counterparty: "Example Market",
          notes: "Paid with card",
          extractionMetadata: {
            confidence: {
              type: 0.99,
              amountMinor: 0.95,
              currencyCode: 0.9,
              occurredOn: 0.85,
              description: 0.8,
              counterparty: 0.9,
            },
            warnings: ["Total was slightly blurred."],
          },
        },
      ],
      discardedCandidateCount: 0,
    });
  });

  it.each([
    ["0", "The extracted transaction amount was invalid and was removed."],
    ["-100", "The extracted transaction amount was invalid and was removed."],
    ["12.34", "The extracted transaction amount was invalid and was removed."],
    [
      "9223372036854775808",
      "The extracted transaction amount exceeded the supported range and was removed.",
    ],
  ])("removes invalid minor-unit amount %s", (amountMinor, warning) => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({ amountMinor }),
    ]);

    expect(result.candidates[0]).toMatchObject({ amountMinor: null });
    expect(result.candidates[0]?.extractionMetadata.warnings).toContain(
      warning,
    );
  });

  it("removes unsupported currencies and impossible calendar dates", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        currencyCode: "ZZZ",
        occurredOn: "2026-02-29",
      }),
    ]);

    expect(result.candidates[0]).toMatchObject({
      currencyCode: null,
      occurredOn: null,
    });
    expect(result.candidates[0]?.extractionMetadata.warnings).toEqual(
      expect.arrayContaining([
        "The extracted currency code was invalid and was removed.",
        "The extracted transaction date was invalid and was removed.",
      ]),
    );
  });

  it.each(["2024-02-29", "2000-02-29"])(
    "accepts valid leap-day date %s",
    (occurredOn) => {
      const result = normalizeExtractedTransactionCandidates([
        createCandidate({ occurredOn }),
      ]);

      expect(result.candidates[0]?.occurredOn).toBe(occurredOn);
    },
  );

  it("normalizes empty text and safely shortens fields to transaction limits", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        description: `  ${"d".repeat(201)}  `,
        counterparty: "   ",
        notes: "n".repeat(2_001),
      }),
    ]);
    const normalizedCandidate = result.candidates[0];

    expect(normalizedCandidate?.description).toHaveLength(200);
    expect(normalizedCandidate?.counterparty).toBeNull();
    expect(normalizedCandidate?.notes).toHaveLength(2_000);
    expect(normalizedCandidate?.extractionMetadata.warnings).toEqual(
      expect.arrayContaining([
        "The extracted description was shortened to 200 characters.",
        "The extracted counterparty was empty and was removed.",
        "The extracted notes was shortened to 2000 characters.",
      ]),
    );
  });

  it("does not split a multi-unit Unicode character when shortening text", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({ description: "😀".repeat(101) }),
    ]);

    expect(result.candidates[0]?.description).toBe("😀".repeat(100));
    expect(result.candidates[0]?.description).toHaveLength(200);
  });

  it("keeps an incomplete but meaningful candidate for user review", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        type: null,
        amountMinor: null,
        currencyCode: null,
        occurredOn: null,
        description: null,
        counterparty: "Market",
      }),
    ]);

    expect(result.discardedCandidateCount).toBe(0);
    expect(result.candidates[0]).toMatchObject({
      type: null,
      amountMinor: null,
      currencyCode: null,
      occurredOn: null,
      description: null,
      counterparty: "Market",
    });
    expect(result.candidates[0]?.extractionMetadata.warnings).toEqual(
      expect.arrayContaining([
        "The transaction type could not be identified.",
        "The transaction amount could not be identified.",
        "The transaction currency could not be identified.",
        "The transaction date could not be identified.",
        "The transaction description could not be identified.",
      ]),
    );
  });

  it("discards candidates without meaningful transaction data", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        amountMinor: null,
        occurredOn: null,
        description: null,
        counterparty: null,
        notes: "A note by itself is not enough",
      }),
    ]);

    expect(result).toEqual({
      candidates: [],
      discardedCandidateCount: 1,
    });
  });

  it("removes invalid confidence values and de-duplicates warnings", () => {
    const result = normalizeExtractedTransactionCandidates([
      createCandidate({
        confidence: {
          type: 2,
          amountMinor: 0.9,
          currencyCode: Number.NaN,
          occurredOn: null,
          description: -1,
          counterparty: 0.8,
        },
        warnings: ["Blurred value", " Blurred   value "],
      }),
    ]);

    expect(result.candidates[0]?.extractionMetadata).toEqual({
      confidence: {
        amountMinor: 0.9,
        counterparty: 0.8,
      },
      warnings: [
        "Blurred value",
        "Invalid confidence metadata was removed.",
      ],
    });
  });
});
