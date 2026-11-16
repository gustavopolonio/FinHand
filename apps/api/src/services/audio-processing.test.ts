import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioTransactionExtractor } from "../ai/audio-transaction-extractor.js";
import type { AudioTranscriber } from "../ai/audio-transcriber.js";
import type { Database } from "../db/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";

const processNextAudioCandidateExtraction = vi.fn();
const processNextAudioTranscription = vi.fn();

vi.mock("./audio-candidate-extraction.js", () => ({
  processNextAudioCandidateExtraction,
}));
vi.mock("./audio-transcription.js", () => ({
  processNextAudioTranscription,
}));

const { processNextAudioUpload } = await import("./audio-processing.js");

const options = {
  database: {} as Database,
  documentStorage: {} as DocumentStorage,
  extractor: {} as AudioTransactionExtractor,
  leaseDurationMilliseconds: 123,
  transcriber: {} as AudioTranscriber,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("audio processing pipeline", () => {
  it("prioritizes candidate extraction for an existing transcript", async () => {
    const result = {
      uploadId: "upload-id",
      status: "processed" as const,
      candidateCount: 2,
    };
    processNextAudioCandidateExtraction.mockResolvedValue(result);

    await expect(processNextAudioUpload(options)).resolves.toEqual(result);
    expect(processNextAudioCandidateExtraction).toHaveBeenCalledWith({
      database: options.database,
      extractor: options.extractor,
      leaseDurationMilliseconds: 123,
    });
    expect(processNextAudioTranscription).not.toHaveBeenCalled();
  });

  it("transcribes a recording when no transcript needs extraction", async () => {
    const result = { uploadId: "upload-id", status: "transcribed" as const };
    processNextAudioCandidateExtraction.mockResolvedValue(null);
    processNextAudioTranscription.mockResolvedValue(result);

    await expect(processNextAudioUpload(options)).resolves.toEqual(result);
    expect(processNextAudioTranscription).toHaveBeenCalledWith({
      database: options.database,
      documentStorage: options.documentStorage,
      leaseDurationMilliseconds: 123,
      transcriber: options.transcriber,
    });
  });
});
