"use client";

import {
  Camera,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DocumentFilePicker } from "@/components/documents/document-file-picker";
import { ReceiptCameraPicker } from "@/components/documents/receipt-camera-picker";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  getDocumentCaptureSession,
  uploadCaptureDocument,
} from "@/lib/api";
import { cn } from "@/lib/class-names";

import { retainCaptureToken } from "./capture-token";

type CaptureMethod = "camera" | "file";
type CaptureState = "validating" | "ready" | "uploading" | "success" | "error";

function captureErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return "This capture link is invalid.";
    if (cause.status === 409) return "This capture link has already been used.";
    if (cause.status === 410) return "This capture link has expired.";
  }

  return cause instanceof Error
    ? cause.message
    : "The capture link could not be opened.";
}

export function MobileCapturePage() {
  const tokenRef = useRef<string | null>(null);
  const [captureState, setCaptureState] =
    useState<CaptureState>("validating");
  const [captureMethod, setCaptureMethod] =
    useState<CaptureMethod>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = retainCaptureToken(tokenRef.current, window.location.hash);
    tokenRef.current = token;

    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }

    void Promise.resolve().then(async () => {
      if (!token) {
        setError("This capture link is invalid.");
        setCaptureState("error");
        return;
      }

      try {
        await getDocumentCaptureSession(token);
        setCaptureState("ready");
      } catch (cause) {
        setError(captureErrorMessage(cause));
        setCaptureState("error");
      }
    });
  }, []);

  function changeMethod(method: CaptureMethod) {
    setCaptureMethod(method);
    setFile(null);
    setValidationError(null);
    setError(null);
  }

  async function submit() {
    const token = tokenRef.current;

    if (!token || !file) {
      setValidationError(
        captureMethod === "camera"
          ? "Take a photo before uploading."
          : "Choose a document before uploading.",
      );
      return;
    }

    setCaptureState("uploading");
    setError(null);

    try {
      await uploadCaptureDocument(token, file);
      tokenRef.current = null;
      setCaptureState("success");
    } catch (cause) {
      setError(captureErrorMessage(cause));
      setCaptureState("ready");
    }
  }

  return (
    <main className="min-h-screen bg-finhand-canvas px-4 py-8 text-finhand-ink sm:px-6">
      <section className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-finhand-border bg-white shadow-finhand-card">
        <header className="border-b border-finhand-divider px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-finhand-primary text-white">
              <LockKeyhole aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-finhand-ink">
                FinHand secure capture
              </span>
              <span className="block text-xs text-finhand-muted">
                One-time receipt upload
              </span>
            </span>
          </div>
        </header>

        {captureState === "validating" ? (
          <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
            <LoaderCircle
              aria-hidden="true"
              className="size-9 animate-spin text-finhand-interactive"
            />
            <h1 className="mt-5 text-xl font-bold">Checking secure link</h1>
            <p className="mt-2 text-sm text-finhand-muted">
              This should only take a moment.
            </p>
          </div>
        ) : null}

        {captureState === "error" ? (
          <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-finhand-expense-soft text-finhand-expense">
              <LockKeyhole aria-hidden="true" className="size-8" />
            </span>
            <h1 className="mt-5 text-xl font-bold">Capture unavailable</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              {error}
            </p>
            <p className="mt-4 text-xs text-finhand-subtle">
              Generate a new QR code from the FinHand desktop app.
            </p>
          </div>
        ) : null}

        {captureState === "success" ? (
          <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-finhand-income-soft text-finhand-income">
              <CheckCircle2 aria-hidden="true" className="size-8" />
            </span>
            <h1 className="mt-5 text-xl font-bold">Receipt sent</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
              Your document was uploaded securely. You can close this page and
              return to FinHand on your computer.
            </p>
          </div>
        ) : null}

        {captureState === "ready" || captureState === "uploading" ? (
          <div>
            <div className="px-6 pt-6 text-center">
              <h1 className="text-xl font-bold">Add your receipt</h1>
              <p className="mt-2 text-sm leading-6 text-finhand-muted">
                Take a clear photo or choose a receipt already saved on this
                device.
              </p>
            </div>

            <div
              aria-label="Receipt capture method"
              className="mx-6 mt-5 grid grid-cols-2 gap-1 rounded-xl bg-finhand-canvas-muted p-1"
              role="group"
            >
              {([
                { value: "camera", label: "Take photo", icon: Camera },
                { value: "file", label: "Choose file", icon: FileUp },
              ] as const).map((method) => {
                const Icon = method.icon;
                const isSelected = captureMethod === method.value;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                      isSelected
                        ? "bg-white text-finhand-primary shadow-finhand-card"
                        : "text-finhand-muted",
                    )}
                    disabled={captureState === "uploading"}
                    key={method.value}
                    onClick={() => changeMethod(method.value)}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {method.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 p-6">
              {captureMethod === "camera" ? (
                <ReceiptCameraPicker
                  disabled={captureState === "uploading"}
                  file={file}
                  onChange={setFile}
                  onValidationError={setValidationError}
                />
              ) : (
                <DocumentFilePicker
                  disabled={captureState === "uploading"}
                  file={file}
                  onChange={setFile}
                  onValidationError={setValidationError}
                />
              )}

              {validationError || error ? (
                <p
                  className="rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
                  role="alert"
                >
                  {validationError ?? error}
                </p>
              ) : null}
            </div>

            <footer className="border-t border-finhand-divider bg-finhand-canvas-muted p-5">
              <Button
                className="w-full rounded-xl!"
                disabled={captureState === "uploading" || !file}
                onClick={() => void submit()}
              >
                {captureState === "uploading" ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <Upload aria-hidden="true" className="size-4" />
                )}
                {captureState === "uploading"
                  ? "Uploading securely…"
                  : "Send receipt"}
              </Button>
              <p className="mt-3 text-center text-[11px] text-finhand-subtle">
                This link permits one upload and does not expose financial
                information.
              </p>
            </footer>
          </div>
        ) : null}
      </section>
    </main>
  );
}
