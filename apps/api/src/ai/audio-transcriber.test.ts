import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { createOpenAiAudioTranscriber } from "./audio-transcriber.js";

function createClient(response: Record<string, unknown>) {
  const create = vi.fn().mockResolvedValue(response);
  const client = {
    audio: { transcriptions: { create } },
  } as unknown as OpenAI;

  return { client, create };
}

describe("OpenAI audio transcriber", () => {
  it("uploads the completed recording and returns normalized transcript metadata", async () => {
    const { client, create } = createClient({
      text: "  Mercado, cinquenta reais.  ",
      languages: [{ code: "PT" }],
      usage: {
        type: "tokens",
        input_tokens: 120,
        output_tokens: 10,
        total_tokens: 130,
      },
    });
    const transcriber = createOpenAiAudioTranscriber({
      apiKey: "test-api-key",
      client,
      model: "gpt-transcribe",
    });
    const content = Buffer.from("audio-content");

    await expect(
      transcriber.transcribeAudio({
        content,
        fileName: "voice-recording.webm",
        mimeType: "audio/webm",
      }),
    ).resolves.toEqual({
      model: "gpt-transcribe",
      text: "Mercado, cinquenta reais.",
      metadata: {
        languageCodes: ["pt"],
        usage: {
          type: "tokens",
          inputTokens: 120,
          outputTokens: 10,
          totalTokens: 130,
        },
      },
    });

    const request = create.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "gpt-transcribe",
      response_format: "json",
      file: expect.objectContaining({
        name: "voice-recording.webm",
        type: "audio/webm",
      }),
    });
    expect(Buffer.from(await request.file.arrayBuffer())).toEqual(content);
  });

  it("supports duration-based usage and an absent detected language", async () => {
    const { client } = createClient({
      text: "Salary five thousand reais",
      usage: { type: "duration", seconds: 4.5 },
    });
    const transcriber = createOpenAiAudioTranscriber({
      apiKey: "test-api-key",
      client,
      model: "gpt-transcribe",
    });

    await expect(
      transcriber.transcribeAudio({
        content: Buffer.from("audio-content"),
        fileName: "voice-recording.m4a",
        mimeType: "audio/mp4",
      }),
    ).resolves.toEqual({
      model: "gpt-transcribe",
      text: "Salary five thousand reais",
      metadata: { usage: { type: "duration", seconds: 4.5 } },
    });
  });

  it.each([
    {
      apiKey: "",
      model: "gpt-transcribe",
      message: "An OpenAI API key is required.",
    },
    {
      apiKey: "test-key",
      model: "",
      message: "An OpenAI audio transcription model is required.",
    },
  ])("rejects invalid client configuration", ({ apiKey, message, model }) => {
    const { client } = createClient({ text: "unused" });

    expect(() =>
      createOpenAiAudioTranscriber({ apiKey, client, model }),
    ).toThrow(message);
  });
});
