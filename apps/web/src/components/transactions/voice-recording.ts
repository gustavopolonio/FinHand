export const maximumVoiceRecordingSeconds = 30;

export const supportedVoiceRecordingMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function selectVoiceRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | null {
  return (
    supportedVoiceRecordingMimeTypes.find((mimeType) =>
      isTypeSupported(mimeType),
    ) ?? null
  );
}

export function voiceRecordingElapsedSeconds(
  startedAtMilliseconds: number,
  currentMilliseconds: number,
): number {
  const elapsedMilliseconds = voiceRecordingDurationMilliseconds(
    0,
    startedAtMilliseconds,
    currentMilliseconds,
  );

  return Math.floor(elapsedMilliseconds / 1_000);
}

export function voiceRecordingDurationMilliseconds(
  accumulatedMilliseconds: number,
  activeSegmentStartedAtMilliseconds: number | null,
  currentMilliseconds: number,
): number {
  const activeMilliseconds =
    activeSegmentStartedAtMilliseconds === null
      ? 0
      : Math.max(
          0,
          currentMilliseconds - activeSegmentStartedAtMilliseconds,
        );

  return Math.min(
    maximumVoiceRecordingSeconds * 1_000,
    Math.max(0, accumulatedMilliseconds) + activeMilliseconds,
  );
}

export function formatVoiceRecordingDuration(seconds: number): string {
  const safeSeconds = Math.max(
    0,
    Math.min(maximumVoiceRecordingSeconds, Math.floor(seconds)),
  );

  return `00:${String(safeSeconds).padStart(2, "0")}`;
}

export function calculateVoiceInputLevel(samples: Uint8Array): number {
  if (samples.length === 0) return 0;

  let squaredAmplitudeTotal = 0;

  for (const sample of samples) {
    const normalizedAmplitude = (sample - 128) / 128;
    squaredAmplitudeTotal += normalizedAmplitude * normalizedAmplitude;
  }

  const rootMeanSquare = Math.sqrt(
    squaredAmplitudeTotal / samples.length,
  );

  return Math.min(1, rootMeanSquare * 4);
}

export function microphoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone access was denied. Allow access in your browser settings and try again.";
    }

    if (error.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }

    if (error.name === "NotReadableError") {
      return "The microphone is already in use by another application.";
    }
  }

  return "The microphone could not be started. Check your browser permissions and try again.";
}
