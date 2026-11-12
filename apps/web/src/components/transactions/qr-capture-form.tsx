"use client";

import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import type {
  Account,
  Category,
  ConfirmTransactionCandidateInput,
  ConfirmTransactionCandidateResult,
  DocumentCaptureSession,
  DocumentCaptureSessionProgress,
  DocumentProcessingStatus,
  TransactionCandidate,
  TransactionCandidateReview,
  RejectTransactionCandidateResult,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import {
  shouldContinueCaptureSessionPolling,
  startCaptureSessionPolling,
} from "./capture-session-polling";
import { TransactionCandidateReviewPanel } from "./transaction-candidate-review";

interface QrCaptureFormProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  isManaging: boolean;
  onCancel: (sessionId: string) => Promise<void>;
  onClearError: () => void;
  onClose: () => void;
  onConfirmCandidate: (
    candidateId: string,
    input: ConfirmTransactionCandidateInput,
  ) => Promise<ConfirmTransactionCandidateResult | null>;
  onCreate: () => Promise<DocumentCaptureSession | null>;
  onGetProgress: (
    sessionId: string,
  ) => Promise<DocumentCaptureSessionProgress | null>;
  onGetReview: (
    uploadId: string,
  ) => Promise<TransactionCandidateReview | null>;
  onRejectCandidate: (
    candidateId: string,
  ) => Promise<RejectTransactionCandidateResult | null>;
  onUpdateCandidate: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
}

interface ActiveCaptureSession extends DocumentCaptureSession {
  progress: DocumentCaptureSessionProgress | null;
}

function secondsUntil(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - now) / 1_000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function processingMessage(
  status: DocumentProcessingStatus | undefined,
) {
  switch (status) {
    case "processing":
      return {
        title: "Processing your receipt",
        description:
          "The receipt was received and is being prepared for review.",
      };
    case "processed":
      return {
        title: "Receipt ready for review",
        description:
          "Processing is complete. You can continue with the extracted transaction.",
      };
    case "failed":
      return {
        title: "Receipt processing failed",
        description:
          "The receipt was uploaded, but it could not be processed. You can close this window and try again.",
      };
    default:
      return {
        title: "Receipt received",
        description:
          "Your receipt was uploaded securely and is waiting to be processed.",
      };
  }
}

export function QrCaptureForm({
  accounts,
  categories,
  error,
  isManaging,
  onCancel,
  onClearError,
  onClose,
  onConfirmCandidate,
  onCreate,
  onGetProgress,
  onGetReview,
  onRejectCandidate,
  onUpdateCandidate,
}: QrCaptureFormProps) {
  const [session, setSession] = useState<ActiveCaptureSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const sessionRef = useRef<DocumentCaptureSession | null>(null);

  useEffect(() => {
    if (!session) return;

    const updateCountdown = () => {
      const seconds = secondsUntil(session.expiresAt);
      setRemainingSeconds(seconds);

      if (seconds === 0) {
        sessionRef.current = null;
      }
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1_000);

    return () => window.clearInterval(intervalId);
  }, [session]);

  const sessionId = session?.id;

  useEffect(() => {
    if (!sessionId) return;

    const polling = startCaptureSessionPolling({
      readProgress: () => onGetProgress(sessionId),
      onProgress(progress) {
        onClearError();
        setSession((currentSession) =>
          currentSession?.id === sessionId
            ? { ...currentSession, progress }
            : currentSession,
        );

        if (progress.status !== "pending") {
          sessionRef.current = null;
        }
      },
    });

    return polling.stop;
  }, [onClearError, onGetProgress, sessionId]);

  useEffect(
    () => () => {
      const activeSession = sessionRef.current;
      if (activeSession) void onCancel(activeSession.id);
    },
    [onCancel],
  );

  async function createSession() {
    onClearError();
    const createdSession = await onCreate();

    if (createdSession) {
      sessionRef.current = createdSession;
      setSession({ ...createdSession, progress: null });
      setRemainingSeconds(secondsUntil(createdSession.expiresAt));
    }
  }

  async function cancelSession() {
    const activeSession = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    setRemainingSeconds(0);

    if (activeSession) await onCancel(activeSession.id);
  }

  const progress = session?.progress;
  const progressUploadId = progress?.upload?.id;
  const progressUploadStatus = progress?.upload?.status;

  useEffect(() => {
    if (progressUploadId && progressUploadStatus === "failed") {
      void onGetReview(progressUploadId);
    }
  }, [onGetReview, progressUploadId, progressUploadStatus]);

  const isConsumed = progress?.status === "consumed";
  const isExpired =
    !!session &&
    (remainingSeconds === 0 || progress?.status === "expired");
  const isCancelled = progress?.status === "cancelled";
  const isUnavailable = isExpired || isCancelled;
  const progressMessage = processingMessage(progress?.upload?.status);

  if (progress?.upload?.status === "processed") {
    return (
      <TransactionCandidateReviewPanel
        accounts={accounts}
        categories={categories}
        error={error}
        onConfirm={onConfirmCandidate}
        onClose={onClose}
        onGetReview={onGetReview}
        onReject={onRejectCandidate}
        onUpdate={onUpdateCandidate}
        panelId="transaction-qr-panel"
        tabId="transaction-qr-tab"
        uploadId={progress.upload.id}
      />
    );
  }

  return (
    <div
      aria-labelledby="transaction-qr-tab"
      className="flex min-h-0 flex-1 flex-col"
      id="transaction-qr-panel"
    >
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
        {session && isConsumed ? (
          <>
            <span
              className={`grid size-16 place-items-center rounded-full ${
                progress?.upload?.status === "failed"
                  ? "bg-finhand-expense-soft text-finhand-expense"
                  : "bg-finhand-income-soft text-finhand-income"
              }`}
            >
              {progress?.upload?.status === "failed" ? (
                <CircleAlert aria-hidden="true" className="size-8" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-8" />
              )}
            </span>
            <h3 className="mt-5 text-lg font-bold text-finhand-ink">
              {progressMessage.title}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              {progressMessage.description}
            </p>
            {shouldContinueCaptureSessionPolling(progress) ? (
              <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-finhand-accent-border bg-finhand-accent-soft px-3 py-1 text-xs font-semibold text-finhand-interactive">
                <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
                Checking status
              </span>
            ) : null}
          </>
        ) : session && !isUnavailable ? (
          <>
            <div className="rounded-3xl border border-finhand-border bg-white p-4 shadow-finhand-card">
              <QRCodeSVG
                aria-label="QR code for mobile receipt capture"
                bgColor="#ffffff"
                fgColor="#1e2a52"
                level="M"
                marginSize={1}
                size={220}
                title="Scan to capture a receipt"
                value={session.captureUrl}
              />
            </div>
            <h3 className="mt-5 text-lg font-bold text-finhand-ink">
              Scan with your phone
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              Open your phone camera, scan this code, and take or select a
              receipt. No mobile sign-in is required.
            </p>
            <span className="mt-4 rounded-full border border-finhand-accent-border bg-finhand-accent-soft px-3 py-1 text-xs font-semibold text-finhand-interactive">
              Expires in {formatCountdown(remainingSeconds)}
            </span>
          </>
        ) : (
          <>
            <span className="grid size-16 place-items-center rounded-2xl bg-finhand-accent text-finhand-interactive">
              {isUnavailable ? (
                <RefreshCw aria-hidden="true" className="size-8" />
              ) : (
                <Smartphone aria-hidden="true" className="size-8" />
              )}
            </span>
            <h3 className="mt-5 text-lg font-bold text-finhand-ink">
              {isExpired
                ? "QR code expired"
                : isCancelled
                  ? "QR code cancelled"
                  : "Continue on your phone"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              {isUnavailable
                ? "Generate a new secure code to continue."
                : "Generate a secure QR code that permits one receipt upload and expires after five minutes."}
            </p>
            <Button
              className="mt-6 rounded-xl!"
              disabled={isManaging}
              onClick={() => {
                if (isUnavailable) {
                  sessionRef.current = null;
                  setSession(null);
                }
                void createSession();
              }}
            >
              {isManaging ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <QrCode aria-hidden="true" className="size-4" />
              )}
              {isManaging ? "Generating…" : "Generate QR code"}
            </Button>
          </>
        )}

        {error ? (
          <p
            className="mt-4 rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
        {session && !isUnavailable && !isConsumed ? (
          <Button
            className="rounded-xl!"
            disabled={isManaging}
            onClick={() => void cancelSession()}
            variant="secondary"
          >
            <X aria-hidden="true" className="size-4" />
            Cancel QR
          </Button>
        ) : null}
        <Button
          className="rounded-xl!"
          disabled={isManaging}
          onClick={onClose}
          variant="ghost"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
