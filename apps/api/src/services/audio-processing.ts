import type { AudioTransactionExtractor } from "../ai/audio-transaction-extractor.js";
import type { AudioTranscriber } from "../ai/audio-transcriber.js";
import type { Database } from "../db/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import {
  processNextAudioCandidateExtraction,
  type AudioCandidateExtractionResult,
} from "./audio-candidate-extraction.js";
import {
  processNextAudioTranscription,
  type AudioTranscriptionResult,
} from "./audio-transcription.js";

interface ProcessNextAudioUploadOptions {
  database: Database;
  documentStorage: DocumentStorage;
  extractor: AudioTransactionExtractor;
  leaseDurationMilliseconds?: number;
  transcriber: AudioTranscriber;
}

export type AudioProcessingResult =
  | AudioCandidateExtractionResult
  | AudioTranscriptionResult;

export async function processNextAudioUpload({
  database,
  documentStorage,
  extractor,
  leaseDurationMilliseconds,
  transcriber,
}: ProcessNextAudioUploadOptions): Promise<AudioProcessingResult | null> {
  const extractionResult = await processNextAudioCandidateExtraction({
    database,
    extractor,
    leaseDurationMilliseconds,
  });

  if (extractionResult) return extractionResult;

  return processNextAudioTranscription({
    database,
    documentStorage,
    leaseDurationMilliseconds,
    transcriber,
  });
}
