"use client";

import { FileText, UploadCloud, X } from "lucide-react";
import { type DragEvent, useState } from "react";

import { cn } from "@/lib/class-names";

import {
  documentFileAccept,
  formatDocumentFileSize,
  validateDocumentFile,
} from "./document-file";

interface DocumentFilePickerProps {
  disabled: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
  onValidationError: (message: string | null) => void;
}

export function DocumentFilePicker({
  disabled,
  file,
  onChange,
  onValidationError,
}: DocumentFilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;

    const validationError = validateDocumentFile(nextFile);
    onValidationError(validationError);

    if (validationError) {
      onChange(null);
      return;
    }

    onChange(nextFile);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!disabled) chooseFile(event.dataTransfer.files[0]);
  }

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-finhand-accent-border bg-finhand-accent-soft p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-finhand-interactive shadow-finhand-card">
          <FileText aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-finhand-ink">
            {file.name}
          </span>
          <span className="mt-0.5 block text-xs text-finhand-muted">
            {formatDocumentFileSize(file.size)} · Ready to upload
          </span>
        </span>
        <button
          aria-label={`Remove ${file.name}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-finhand-muted transition hover:bg-white hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            onValidationError(null);
            onChange(null);
          }}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed p-2 transition",
        isDragging
          ? "border-finhand-interactive bg-finhand-accent-soft"
          : "border-finhand-border-strong bg-finhand-canvas-muted",
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFile}
    >
      <label
        className={cn(
          "flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl px-8 py-10 text-center transition focus-within:ring-2 focus-within:ring-finhand-focus focus-within:ring-offset-2",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          accept={documentFileAccept}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            chooseFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <span className="grid size-14 place-items-center rounded-2xl bg-finhand-accent text-finhand-interactive">
          <UploadCloud aria-hidden="true" className="size-7" />
        </span>
        <span className="mt-4 text-sm font-semibold text-finhand-ink">
          Drop your receipt or invoice here
        </span>
        <span className="mt-1.5 text-xs leading-5 text-finhand-muted">
          or click to choose a file from this device
        </span>
        <span className="mt-4 rounded-full border border-finhand-border bg-white px-3 py-1 text-[11px] font-medium text-finhand-muted">
          PDF, JPEG or PNG · Up to 10 MiB
        </span>
      </label>
    </div>
  );
}
