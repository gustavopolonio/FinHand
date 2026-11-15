import OpenAI, { toFile } from "openai";

import type { AudioTranscriptMetadata } from "../db/schema/index.js";
import type { SupportedAudioMimeType } from "../services/audio-uploads.js";

export interface TranscribeAudioInput {
  content: Buffer;
  fileName: string;
  mimeType: SupportedAudioMimeType;
}

export interface AudioTranscription {
  metadata: AudioTranscriptMetadata;
  model: string;
  text: string;
}

export interface AudioTranscriber {
  transcribeAudio(input: TranscribeAudioInput): Promise<AudioTranscription>;
}

interface CreateOpenAiAudioTranscriberOptions {
  apiKey: string;
  client?: OpenAI;
  model: string;
}

export function createOpenAiAudioTranscriber({
  apiKey,
  client = new OpenAI({ apiKey }),
  model,
}: CreateOpenAiAudioTranscriberOptions): AudioTranscriber {
  if (!apiKey.trim()) {
    throw new Error("An OpenAI API key is required.");
  }

  if (!model.trim()) {
    throw new Error("An OpenAI audio transcription model is required.");
  }

  return {
    async transcribeAudio({ content, fileName, mimeType }) {
      const file = await toFile(content, fileName, { type: mimeType });
      const response = await client.audio.transcriptions.create({
        file,
        model,
        response_format: "json",
      });
      const languageCodes = (response.languages ?? [])
        .map(({ code }) => code.trim().toLowerCase())
        .filter(Boolean);
      const usage = response.usage
        ? response.usage.type === "tokens"
          ? {
              type: response.usage.type,
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : {
              type: response.usage.type,
              seconds: response.usage.seconds,
            }
        : undefined;

      return {
        model,
        text: response.text.trim(),
        metadata: {
          ...(languageCodes.length > 0 ? { languageCodes } : {}),
          ...(usage ? { usage } : {}),
        },
      };
    },
  };
}
