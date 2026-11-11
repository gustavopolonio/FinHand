"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";

import { DocumentFilePicker } from "@/components/documents/document-file-picker";
import type {
  Account,
  Category,
  DocumentUpload,
  TransactionCandidate,
  TransactionCandidateReview,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import { TransactionCandidateReviewPanel } from "./transaction-candidate-review";

interface DocumentUploadFormProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  isUploading: boolean;
  onClearError: () => void;
  onClose: () => void;
  onGetReview: (
    uploadId: string,
  ) => Promise<TransactionCandidateReview | null>;
  onUpdateCandidate: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
  onUpload: (file: File) => Promise<DocumentUpload | null>;
}

export function DocumentUploadForm({
  accounts,
  categories,
  error,
  isUploading,
  onClearError,
  onClose,
  onGetReview,
  onUpdateCandidate,
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
      <TransactionCandidateReviewPanel
        accounts={accounts}
        categories={categories}
        error={error}
        onClose={onClose}
        onGetReview={onGetReview}
        onReset={() => {
          setFile(null);
          setUploadedDocument(null);
          setValidationError(null);
          onClearError();
        }}
        onUpdate={onUpdateCandidate}
        panelId="transaction-document-panel"
        tabId="transaction-document-tab"
        uploadId={uploadedDocument.id}
      />
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
            extraction starts automatically after the secure upload.
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
