"use client";

import {
  LoaderCircle,
  LockKeyhole,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";
import {
  calculateVoiceInputLevel,
  formatVoiceRecordingDuration,
  maximumVoiceRecordingSeconds,
  microphoneErrorMessage,
  selectVoiceRecordingMimeType,
  voiceRecordingDurationMilliseconds,
} from "./voice-recording";

export interface VoiceRecording {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}

interface VoiceRecordingFormProps {
  onClose: () => void;
  onRecordingChange?: (recording: VoiceRecording | null) => void;
}

type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopping"
  | "ready";

interface LocalVoiceRecording extends VoiceRecording {
  url: string;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function VoiceRecordingForm({
  onClose,
  onRecordingChange,
}: VoiceRecordingFormProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<LocalVoiceRecording | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [isInputMeterAvailable, setIsInputMeterAvailable] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const recordedMillisecondsRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimationFrameRef = useRef<number | null>(null);
  const meterShouldRunRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopInputMeterAnimation = useCallback(() => {
    if (meterAnimationFrameRef.current !== null) {
      cancelAnimationFrame(meterAnimationFrameRef.current);
      meterAnimationFrameRef.current = null;
    }

    if (isMountedRef.current) setInputLevel(0);
  }, []);

  const closeInputMeter = useCallback(() => {
    meterShouldRunRef.current = false;
    stopInputMeterAnimation();
    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }, [stopInputMeterAnimation]);

  const startInputMeterAnimation = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    stopInputMeterAnimation();
    const samples = new Uint8Array(analyser.fftSize);

    function readInputLevel() {
      const currentAnalyser = analyserRef.current;
      if (
        !isMountedRef.current ||
        !meterShouldRunRef.current ||
        !currentAnalyser
      ) {
        return;
      }

      currentAnalyser.getByteTimeDomainData(samples);
      setInputLevel(calculateVoiceInputLevel(samples));
      meterAnimationFrameRef.current = requestAnimationFrame(readInputLevel);
    }

    readInputLevel();
  }, [stopInputMeterAnimation]);

  const initializeInputMeter = useCallback(
    async (stream: MediaStream) => {
      const AudioContextConstructor =
        window.AudioContext ??
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextConstructor) {
        setIsInputMeterAvailable(false);
        return;
      }

      try {
        const audioContext = new AudioContextConstructor();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        analyserRef.current = analyser;
        setIsInputMeterAvailable(true);

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        if (meterShouldRunRef.current) startInputMeterAnimation();
      } catch {
        closeInputMeter();
        if (isMountedRef.current) setIsInputMeterAvailable(false);
      }
    },
    [closeInputMeter, startInputMeterAnimation],
  );

  const finalizeActiveSegment = useCallback((endedAt = Date.now()) => {
    recordedMillisecondsRef.current = voiceRecordingDurationMilliseconds(
      recordedMillisecondsRef.current,
      activeSegmentStartedAtRef.current,
      endedAt,
    );
    activeSegmentStartedAtRef.current = null;

    return recordedMillisecondsRef.current;
  }, []);

  const stopRecording = useCallback(() => {
    const durationMilliseconds = finalizeActiveSegment();
    clearTimers();
    closeInputMeter();
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      setElapsedSeconds(
        Math.min(
          maximumVoiceRecordingSeconds,
          Math.ceil(durationMilliseconds / 1_000),
        ),
      );
      setStatus("stopping");
      recorder.stop();
    }
  }, [clearTimers, closeInputMeter, finalizeActiveSegment]);

  const scheduleActiveRecording = useCallback(() => {
    const maximumMilliseconds = maximumVoiceRecordingSeconds * 1_000;
    const remainingMilliseconds =
      maximumMilliseconds - recordedMillisecondsRef.current;

    if (remainingMilliseconds <= 0) {
      stopRecording();
      return;
    }

    activeSegmentStartedAtRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const totalMilliseconds = voiceRecordingDurationMilliseconds(
        recordedMillisecondsRef.current,
        activeSegmentStartedAtRef.current,
        Date.now(),
      );
      setElapsedSeconds(Math.floor(totalMilliseconds / 1_000));
    }, 250);
    timeoutRef.current = setTimeout(() => {
      recordedMillisecondsRef.current = maximumMilliseconds;
      activeSegmentStartedAtRef.current = null;
      setElapsedSeconds(maximumVoiceRecordingSeconds);
      stopRecording();
    }, remainingMilliseconds);
  }, [stopRecording]);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.pause();
    const durationMilliseconds = finalizeActiveSegment();
    clearTimers();
    meterShouldRunRef.current = false;
    stopInputMeterAnimation();
    if (audioContextRef.current?.state === "running") {
      void audioContextRef.current.suspend();
    }
    setElapsedSeconds(Math.floor(durationMilliseconds / 1_000));
    setStatus("paused");
  }, [clearTimers, finalizeActiveSegment, stopInputMeterAnimation]);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;

    recorder.resume();
    meterShouldRunRef.current = true;
    if (audioContextRef.current?.state === "suspended") {
      void audioContextRef.current.resume();
    }
    startInputMeterAnimation();
    setStatus("recording");
    scheduleActiveRecording();
  }, [scheduleActiveRecording, startInputMeterAnimation]);

  const discardRecording = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }

    setRecording(null);
    setElapsedSeconds(0);
    setInputLevel(0);
    setError(null);
    setStatus("idle");
    activeSegmentStartedAtRef.current = null;
    recordedMillisecondsRef.current = 0;
    onRecordingChange?.(null);
  }, [onRecordingChange]);

  const startRecording = useCallback(async () => {
    discardRecording();
    setStatus("requesting");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice recording is not supported in this browser. Use a current browser over HTTPS.",
      );
      setStatus("idle");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!isMountedRef.current) {
        stopStream(stream);
        return;
      }

      const mimeType = selectVoiceRecordingMimeType((type) =>
        MediaRecorder.isTypeSupported(type),
      );

      if (!mimeType) {
        stopStream(stream);
        setError(
          "This browser cannot create a supported voice recording format.",
        );
        setStatus("idle");
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      let recorderFailed = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailed = true;
        finalizeActiveSegment();
        clearTimers();
        closeInputMeter();
        stopStream(stream);
        streamRef.current = null;
        recorderRef.current = null;

        if (isMountedRef.current) {
          setError("The recording was interrupted. Please record it again.");
          setStatus("idle");
        }
      };
      recorder.onstop = () => {
        clearTimers();
        closeInputMeter();
        stopStream(stream);
        streamRef.current = null;
        recorderRef.current = null;

        if (!isMountedRef.current || recorderFailed) return;

        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType,
        });

        if (blob.size === 0) {
          setError("No audio was captured. Please record it again.");
          setStatus("idle");
          return;
        }

        const durationSeconds = Math.max(
          1,
          Math.min(
            maximumVoiceRecordingSeconds,
            Math.ceil(recordedMillisecondsRef.current / 1_000),
          ),
        );
        const url = URL.createObjectURL(blob);
        const completedRecording = {
          blob,
          durationSeconds,
          mimeType: blob.type,
          url,
        };

        recordingUrlRef.current = url;
        setRecording(completedRecording);
        setElapsedSeconds(durationSeconds);
        setStatus("ready");
        onRecordingChange?.({ blob, durationSeconds, mimeType: blob.type });
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      setError(null);
      setElapsedSeconds(0);
      setStatus("recording");
      recorder.start();
      meterShouldRunRef.current = true;
      scheduleActiveRecording();
      void initializeInputMeter(stream);
    } catch (cause) {
      clearTimers();
      closeInputMeter();
      stopStream(stream);
      streamRef.current = null;
      recorderRef.current = null;

      if (isMountedRef.current) {
        setError(microphoneErrorMessage(cause));
        setStatus("idle");
      }
    }
  }, [
    clearTimers,
    closeInputMeter,
    discardRecording,
    finalizeActiveSegment,
    initializeInputMeter,
    onRecordingChange,
    scheduleActiveRecording,
  ]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimers();
      closeInputMeter();

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        recorder.stop();
      }

      stopStream(streamRef.current);
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }
    };
  }, [clearTimers, closeInputMeter]);

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isPreparing = status === "requesting" || status === "stopping";
  const inputLevelPercentage = Math.round(inputLevel * 100);
  const inputLevelLabel = !isInputMeterAvailable
    ? "Audio level unavailable"
    : isPaused
      ? "Recording paused"
      : isRecording
        ? inputLevelPercentage >= 4
          ? "Voice detected"
          : "No sound detected"
        : status === "ready"
          ? "Recording ready"
          : "Microphone level";

  return (
    <section
      aria-labelledby="transaction-voice-tab"
      className="flex min-h-0 flex-1 flex-col"
      id="transaction-voice-panel"
    >
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <h3 className="text-base font-bold text-finhand-ink">
              Describe your transactions
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-finhand-muted">
              Mention amounts, merchants, dates, and whether each transaction
              is income or an expense. One recording may include multiple
              transactions.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-finhand-divider bg-finhand-canvas-muted p-6 text-center">
            <div
              aria-label="Live microphone input level"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={isRecording ? inputLevelPercentage : 0}
              className="mx-auto flex h-20 items-end justify-center gap-2"
              role="meter"
            >
              {[0.35, 0.7, 1, 0.7, 0.35].map((heightFactor, index) => (
                <span
                  aria-hidden="true"
                  className={`w-2 rounded-full transition-[height,opacity] duration-75 ${
                    isRecording && inputLevelPercentage >= 4
                      ? "bg-finhand-income opacity-100"
                      : "bg-finhand-interactive opacity-20"
                  }`}
                  key={`${heightFactor}-${index}`}
                  style={{
                    height: `${Math.max(
                      8,
                      (isRecording ? inputLevelPercentage : 0) *
                        0.7 *
                        heightFactor,
                    )}px`,
                  }}
                />
              ))}
            </div>
            <p
              aria-live="polite"
              className={`mt-2 text-xs font-semibold ${
                isRecording && inputLevelPercentage >= 4
                  ? "text-finhand-income"
                  : "text-finhand-muted"
              }`}
            >
              {inputLevelLabel}
            </p>

            <p
              aria-live="polite"
              className="mt-3 font-mono text-3xl font-bold tracking-tight text-finhand-ink"
            >
              {formatVoiceRecordingDuration(elapsedSeconds)}
              <span className="text-base font-medium text-finhand-muted">
                {` / ${formatVoiceRecordingDuration(maximumVoiceRecordingSeconds)}`}
              </span>
            </p>

            {status === "ready" && recording ? (
              <div className="mt-5 space-y-4">
                <audio
                  aria-label="Recorded voice preview"
                  className="w-full"
                  controls
                  preload="metadata"
                  src={recording.url}
                />
                <div className="flex justify-center">
                  <Button
                    onClick={discardRecording}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Discard recording
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                {isRecording || isPaused ? (
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      type="button"
                      variant="secondary"
                    >
                      {isPaused ? (
                        <Play aria-hidden="true" className="size-4 fill-current" />
                      ) : (
                        <Pause aria-hidden="true" className="size-4 fill-current" />
                      )}
                      {isPaused ? "Resume" : "Pause"}
                    </Button>
                    <Button onClick={stopRecording} type="button">
                      <Square aria-hidden="true" className="size-4 fill-current" />
                      Stop
                    </Button>
                  </div>
                ) : (
                  <Button
                    disabled={isPreparing}
                    onClick={() => void startRecording()}
                    type="button"
                  >
                    {isPreparing ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : (
                      <Mic aria-hidden="true" className="size-4" />
                    )}
                    {status === "requesting"
                      ? "Waiting for permission"
                      : status === "stopping"
                        ? "Preparing recording"
                        : "Start recording"}
                  </Button>
                )}

                <p className="mt-3 text-xs text-finhand-muted">
                  {isRecording
                    ? "Recording… Select stop when you are finished."
                    : isPaused
                      ? "Paused time does not count toward the 30-second limit."
                    : `Your browser will ask for microphone access. Maximum ${maximumVoiceRecordingSeconds} seconds.`}
                </p>
              </div>
            )}
          </div>

          {error ? (
            <p
              className="mt-4 rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-finhand-muted">
            <LockKeyhole aria-hidden="true" className="size-3.5" />
            The recording remains on this device until you submit it.
          </p>
        </div>
      </div>

      <div className="flex justify-end border-t border-finhand-divider bg-finhand-canvas-muted p-5">
        <Button onClick={onClose} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </section>
  );
}
