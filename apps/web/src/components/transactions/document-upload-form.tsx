"use client";

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";

import { DocumentFilePicker } from "@/components/documents/document-file-picker";
import type { DocumentUpload } from "@/lib/api";

import { Button } from "../ui/button";

interface DocumentUploadFormProps {
  error: string | null;
  isUploading: boolean;
  onClearError: () => void;
  onClose: () => void;
  onUpload: (file: File) => Promise<DocumentUpload | null>;
}

export function DocumentUploadForm({
  error,
  isUploading,
  onClearError,
  onClose,
  onUpload,
}: DocumentUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadedDocument, setUploadedDocument] =
    useState<DocumentUpload | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setValidationError("Choose a document before uploading.");
      return;
    }

    const upload = await onUpload(file);
    if (upload) setUploadedDocument(upload);
  }

  if (uploadedDocument) {
    return (
      <div
        aria-labelledby="transaction-document-tab"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col"
        id="transaction-document-panel"
      >
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-finhand-income-soft text-finhand-income">
            <CheckCircle2 aria-hidden="true" className="size-8" />
          </span>
          <h3 className="mt-5 text-lg font-bold text-finhand-ink">
            Document uploaded
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
            <span className="font-semibold text-finhand-neutral">
              {uploadedDocument.originalFileName}
            </span>{" "}
            was stored securely and is ready for the processing flow.
          </p>
          <span className="mt-4 rounded-full border border-finhand-income-border bg-finhand-income-soft px-3 py-1 text-xs font-semibold text-finhand-income">
            Status: Uploaded
          </span>
        </div>

        <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
          <Button
            className="rounded-xl!"
            onClick={() => {
              setFile(null);
              setUploadedDocument(null);
              setValidationError(null);
              onClearError();
            }}
            variant="secondary"
          >
            Upload another
          </Button>
          <Button className="rounded-xl!" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const displayedError = validationError ?? error;

  return (
    <form
      aria-busy={isUploading}
      aria-labelledby="transaction-document-tab"
      className="flex min-h-0 flex-1 flex-col"
      id="transaction-document-panel"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div>
          <h3 className="text-sm font-semibold text-finhand-ink">
            Select a receipt or invoice
          </h3>
          <p className="mt-1 text-xs leading-5 text-finhand-muted">
            Your file is validated before being stored privately. Automatic
            extraction will be connected in a later step.
          </p>
        </div>

        <DocumentFilePicker
          disabled={isUploading}
          file={file}
          onChange={(nextFile) => {
            setFile(nextFile);
            onClearError();
          }}
          onValidationError={setValidationError}
        />

        {displayedError ? (
          <p
            className="rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
            role="alert"
          >
            {displayedError}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
        <Button
          className="rounded-xl!"
          disabled={isUploading}
          onClick={onClose}
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          className="rounded-xl!"
          disabled={isUploading || !file}
          type="submit"
        >
          {isUploading ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {isUploading ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
