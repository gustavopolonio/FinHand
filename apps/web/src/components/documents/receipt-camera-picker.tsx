"use client";

import { Camera, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  formatDocumentFileSize,
  receiptPhotoAccept,
  validateReceiptPhoto,
} from "./document-file";

interface ReceiptCameraPickerProps {
  disabled: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
  onValidationError: (message: string | null) => void;
}

export function ReceiptCameraPicker({
  disabled,
  file,
  onChange,
  onValidationError,
}: ReceiptCameraPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{
    file: File;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const timeoutId = window.setTimeout(() => {
      setPreview({ file, url: objectUrl });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  function choosePhoto(nextFile: File | undefined) {
    if (!nextFile) return;

    const validationError = validateReceiptPhoto(nextFile);
    onValidationError(validationError);

    if (validationError) {
      onChange(null);
      return;
    }

    onChange(nextFile);
  }

  function openCamera() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-4">
      <input
        accept={receiptPhotoAccept}
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          choosePhoto(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      {file ? (
        <div className="overflow-hidden rounded-2xl border border-finhand-border bg-finhand-canvas-muted">
          <div className="grid min-h-64 place-items-center bg-finhand-ink p-2">
            {preview?.file === file ? (
              // A local object URL previews only the photo selected by the user.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Receipt preview"
                className="max-h-80 w-full rounded-xl object-contain"
                src={preview.url}
              />
            ) : (
              <Camera
                aria-hidden="true"
                className="size-10 text-white/70"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-finhand-ink">
                {file.name}
              </span>
              <span className="text-xs text-finhand-muted">
                {formatDocumentFileSize(file.size)} · Ready to upload
              </span>
            </span>
            <Button
              disabled={disabled}
              onClick={openCamera}
              size="sm"
              variant="secondary"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Retake
            </Button>
            <Button
              aria-label="Remove captured photo"
              disabled={disabled}
              onClick={() => {
                onValidationError(null);
                onChange(null);
              }}
              size="sm"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-finhand-border-strong bg-finhand-canvas-muted px-8 py-10 text-center transition hover:border-finhand-interactive hover:bg-finhand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onClick={openCamera}
          type="button"
        >
          <span className="grid size-16 place-items-center rounded-2xl bg-finhand-accent text-finhand-interactive">
            <Camera aria-hidden="true" className="size-8" />
          </span>
          <span className="mt-4 text-sm font-semibold text-finhand-ink">
            Open rear camera
          </span>
          <span className="mt-1.5 max-w-xs text-xs leading-5 text-finhand-muted">
            Place the entire receipt inside the frame and make sure the text is
            clear.
          </span>
          <span className="mt-4 rounded-full border border-finhand-border bg-white px-3 py-1 text-[11px] font-medium text-finhand-muted">
            JPEG or PNG · Up to 10 MiB
          </span>
        </button>
      )}
    </div>
  );
}
