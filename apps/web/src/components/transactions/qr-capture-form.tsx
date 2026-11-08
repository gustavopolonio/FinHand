"use client";

import { LoaderCircle, QrCode, RefreshCw, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import type { DocumentCaptureSession } from "@/lib/api";

import { Button } from "../ui/button";

interface QrCaptureFormProps {
  error: string | null;
  isManaging: boolean;
  onCancel: (sessionId: string) => Promise<void>;
  onClearError: () => void;
  onClose: () => void;
  onCreate: () => Promise<DocumentCaptureSession | null>;
}

function secondsUntil(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - now) / 1_000));
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function QrCaptureForm({
  error,
  isManaging,
  onCancel,
  onClearError,
  onClose,
  onCreate,
}: QrCaptureFormProps) {
  const [session, setSession] = useState<DocumentCaptureSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const sessionRef = useRef<DocumentCaptureSession | null>(null);

  useEffect(() => {
    if (!session) return;

    const updateCountdown = () => {
      setRemainingSeconds(secondsUntil(session.expiresAt));
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1_000);

    return () => window.clearInterval(intervalId);
  }, [session]);

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
      setSession(createdSession);
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

  const isExpired = !!session && remainingSeconds === 0;

  return (
    <div
      aria-labelledby="transaction-qr-tab"
      className="flex min-h-0 flex-1 flex-col"
      id="transaction-qr-panel"
    >
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
        {session && !isExpired ? (
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
              {isExpired ? (
                <RefreshCw aria-hidden="true" className="size-8" />
              ) : (
                <Smartphone aria-hidden="true" className="size-8" />
              )}
            </span>
            <h3 className="mt-5 text-lg font-bold text-finhand-ink">
              {isExpired ? "QR code expired" : "Continue on your phone"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              {isExpired
                ? "Generate a new secure code to continue."
                : "Generate a secure QR code that permits one receipt upload and expires after five minutes."}
            </p>
            <Button
              className="mt-6 rounded-xl!"
              disabled={isManaging}
              onClick={() => {
                if (isExpired) {
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
        {session && !isExpired ? (
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
