import type { ExtractedTransactionCandidate } from "../ai/document-transaction-extractor.js";
import type {
  TransactionCandidateExtractionMetadata,
  TransactionType,
} from "../db/schema/index.js";

const maximumPostgresBigInt = 9_223_372_036_854_775_807n;
const maximumDescriptionLength = 200;
const maximumCounterpartyLength = 200;
const maximumNotesLength = 2_000;
const maximumWarningLength = 200;
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

export interface NormalizedTransactionCandidate {
  type: TransactionType | null;
  amountMinor: bigint | null;
  currencyCode: string | null;
  occurredOn: string | null;
  description: string | null;
  counterparty: string | null;
  notes: string | null;
  extractionMetadata: TransactionCandidateExtractionMetadata;
}

export interface TransactionCandidateNormalizationResult {
  candidates: NormalizedTransactionCandidate[];
  discardedCandidateCount: number;
}

interface NormalizationContext {
  warnings: Set<string>;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function truncateWithoutSplittingCharacters(
  value: string,
  maximumLength: number,
): string {
  let result = "";

  for (const character of value) {
    if (result.length + character.length > maximumLength) {
      break;
    }

    result += character;
  }

  return result;
}

function addWarning(context: NormalizationContext, warning: string) {
  const normalizedWarning = normalizeWhitespace(warning);

  if (normalizedWarning) {
    context.warnings.add(
      Array.from(normalizedWarning).slice(0, maximumWarningLength).join(""),
    );
  }
}

function normalizeType(
  value: ExtractedTransactionCandidate["type"],
  context: NormalizationContext,
): TransactionType | null {
  if (value === "income" || value === "expense") {
    return value;
  }

  addWarning(
    context,
    value === null
      ? "The transaction type could not be identified."
      : "The extracted transaction type was invalid and was removed.",
  );
  return null;
}

function normalizeAmountMinor(
  value: string | null,
  context: NormalizationContext,
): bigint | null {
  if (value === null) {
    addWarning(context, "The transaction amount could not be identified.");
    return null;
  }

  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    addWarning(
      context,
      "The extracted transaction amount was invalid and was removed.",
    );
    return null;
  }

  const amountMinor = BigInt(normalizedValue);

  if (amountMinor === 0n) {
    addWarning(
      context,
      "The extracted transaction amount was invalid and was removed.",
    );
    return null;
  }

  if (amountMinor > maximumPostgresBigInt) {
    addWarning(
      context,
      "The extracted transaction amount exceeded the supported range and was removed.",
    );
    return null;
  }

  return amountMinor;
}

function normalizeCurrencyCode(
  value: string | null,
  context: NormalizationContext,
): string | null {
  if (value === null) {
    addWarning(context, "The transaction currency could not be identified.");
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!supportedCurrencies.has(normalizedValue)) {
    addWarning(
      context,
      "The extracted currency code was invalid and was removed.",
    );
    return null;
  }

  return normalizedValue;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]!
  );
}

function normalizeOccurredOn(
  value: string | null,
  context: NormalizationContext,
): string | null {
  if (value === null) {
    addWarning(context, "The transaction date could not be identified.");
    return null;
  }

  const normalizedValue = value.trim();

  if (!isValidCalendarDate(normalizedValue)) {
    addWarning(
      context,
      "The extracted transaction date was invalid and was removed.",
    );
    return null;
  }

  return normalizedValue;
}

function normalizeText(
  value: string | null,
  maximumLength: number,
  fieldLabel: string,
  context: NormalizationContext,
): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = normalizeWhitespace(value);

  if (!normalizedValue) {
    addWarning(
      context,
      `The extracted ${fieldLabel} was empty and was removed.`,
    );
    return null;
  }

  if (normalizedValue.length > maximumLength) {
    addWarning(
      context,
      `The extracted ${fieldLabel} was shortened to ${maximumLength} characters.`,
    );
    return truncateWithoutSplittingCharacters(normalizedValue, maximumLength);
  }

  return normalizedValue;
}

function normalizeConfidence(
  confidence: ExtractedTransactionCandidate["confidence"],
  context: NormalizationContext,
): Record<string, number> | undefined {
  const normalizedConfidence = Object.fromEntries(
    Object.entries(confidence).filter((entry): entry is [string, number] => {
      const value = entry[1];
      return (
        value !== null &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
      );
    }),
  );

  if (
    Object.values(confidence).some(
      (value) =>
        value !== null &&
        (!Number.isFinite(value) || value < 0 || value > 1),
    )
  ) {
    addWarning(context, "Invalid confidence metadata was removed.");
  }

  return Object.keys(normalizedConfidence).length > 0
    ? normalizedConfidence
    : undefined;
}

function isUsableForReview(
  candidate: NormalizedTransactionCandidate,
): boolean {
  return (
    candidate.amountMinor !== null ||
    candidate.occurredOn !== null ||
    candidate.description !== null ||
    candidate.counterparty !== null
  );
}

function normalizeCandidate(
  candidate: ExtractedTransactionCandidate,
): NormalizedTransactionCandidate | null {
  const context: NormalizationContext = {
    warnings: new Set<string>(),
  };

  for (const warning of candidate.warnings) {
    addWarning(context, warning);
  }

  const type = normalizeType(candidate.type, context);
  const amountMinor = normalizeAmountMinor(candidate.amountMinor, context);
  const currencyCode = normalizeCurrencyCode(
    candidate.currencyCode,
    context,
  );
  const occurredOn = normalizeOccurredOn(candidate.occurredOn, context);
  const description = normalizeText(
    candidate.description,
    maximumDescriptionLength,
    "description",
    context,
  );
  const counterparty = normalizeText(
    candidate.counterparty,
    maximumCounterpartyLength,
    "counterparty",
    context,
  );
  const notes = normalizeText(
    candidate.notes,
    maximumNotesLength,
    "notes",
    context,
  );

  if (description === null) {
    addWarning(context, "The transaction description could not be identified.");
  }

  const confidence = normalizeConfidence(candidate.confidence, context);
  const normalizedCandidate: NormalizedTransactionCandidate = {
    type,
    amountMinor,
    currencyCode,
    occurredOn,
    description,
    counterparty,
    notes,
    extractionMetadata: {
      ...(confidence ? { confidence } : {}),
      ...(context.warnings.size > 0
        ? { warnings: [...context.warnings] }
        : {}),
    },
  };

  return isUsableForReview(normalizedCandidate)
    ? normalizedCandidate
    : null;
}

export function normalizeExtractedTransactionCandidates(
  candidates: ExtractedTransactionCandidate[],
): TransactionCandidateNormalizationResult {
  const normalizedCandidates = candidates
    .map(normalizeCandidate)
    .filter(
      (candidate): candidate is NormalizedTransactionCandidate =>
        candidate !== null,
    );

  return {
    candidates: normalizedCandidates,
    discardedCandidateCount:
      candidates.length - normalizedCandidates.length,
  };
}
