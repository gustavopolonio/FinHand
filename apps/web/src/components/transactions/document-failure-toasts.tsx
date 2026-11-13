"use client";

import { CircleAlert, LoaderCircle, RotateCcw, Upload, X } from "lucide-react";

import type { DocumentProcessingFailure } from "@/lib/api";

import { Button } from "../ui/button";

export interface DocumentFailureNotice {
  uploadId: string;
  originalFileName: string;
  failure: DocumentProcessingFailure;
}

interface DocumentFailureToastsProps {
  notices: DocumentFailureNotice[];
  onDismiss: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
  onUploadAnother: (uploadId: string) => void;
  retryingUploadId: string | null;
}

export function DocumentFailureToasts({
  notices,
  onDismiss,
  onRetry,
  onUploadAnother,
  retryingUploadId,
}: DocumentFailureToastsProps) {
  if (notices.length === 0) return null;

  return (
    <div
      aria-label="Document processing notifications"
      aria-live="assertive"
      className="fixed right-6 top-6 z-70 flex w-96 max-w-[calc(100vw-3rem)] flex-col gap-3"
    >
      {notices.map((notice) => (
        <div
          className="rounded-2xl border border-finhand-expense/20 bg-white p-4 shadow-finhand-modal"
          key={notice.uploadId}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-finhand-expense-soft text-finhand-expense">
              <CircleAlert aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-finhand-ink">
                Document processing failed
              </p>
              <p className="mt-1 text-xs leading-5 text-finhand-muted">
                <span className="block font-semibold text-finhand-neutral">
                  {notice.originalFileName}
                </span>
                <span className="block">{notice.failure.message}</span>
              </p>
            </div>
            <button
              aria-label={`Dismiss failure for ${notice.originalFileName}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-finhand-muted transition hover:bg-finhand-canvas-muted hover:text-finhand-ink"
              onClick={() => onDismiss(notice.uploadId)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button
              onClick={() => onDismiss(notice.uploadId)}
              size="sm"
              variant="ghost"
            >
              Dismiss
            </Button>
            {notice.failure.canRetry ? (
              <Button
                disabled={retryingUploadId !== null}
                onClick={() => onRetry(notice.uploadId)}
                size="sm"
                variant="secondary"
              >
                {retryingUploadId === notice.uploadId ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <RotateCcw aria-hidden="true" className="size-4" />
                )}
                {retryingUploadId === notice.uploadId
                  ? "Retrying"
                  : "Retry processing"}
              </Button>
            ) : (
              <Button
                onClick={() => onUploadAnother(notice.uploadId)}
                size="sm"
                variant="secondary"
              >
                <Upload aria-hidden="true" className="size-4" />
                Upload another
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
