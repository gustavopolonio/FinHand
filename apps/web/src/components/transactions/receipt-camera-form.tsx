"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";

import { ReceiptCameraPicker } from "@/components/documents/receipt-camera-picker";
import type {
  Account,
  Category,
  ConfirmTransactionCandidateInput,
  ConfirmTransactionCandidateResult,
  DocumentUpload,
  TransactionCandidate,
  TransactionCandidateReview,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import { TransactionCandidateReviewPanel } from "./transaction-candidate-review";

interface ReceiptCameraFormProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  isUploading: boolean;
  onClearError: () => void;
  onClose: () => void;
  onConfirmCandidate: (
    candidateId: string,
    input: ConfirmTransactionCandidateInput,
  ) => Promise<ConfirmTransactionCandidateResult | null>;
  onGetReview: (
    uploadId: string,
  ) => Promise<TransactionCandidateReview | null>;
  onUpdateCandidate: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
  onUpload: (file: File) => Promise<DocumentUpload | null>;
}

export function ReceiptCameraForm({
  accounts,
  categories,
  error,
  isUploading,
  onClearError,
  onClose,
  onConfirmCandidate,
  onGetReview,
  onUpdateCandidate,
  onUpload,
}: ReceiptCameraFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadedDocument, setUploadedDocument] =
    useState<DocumentUpload | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setValidationError("Take a photo before uploading.");
      return;
    }

    const upload = await onUpload(file);
    if (upload) setUploadedDocument(upload);
  }

  function reset() {
    setFile(null);
    setUploadedDocument(null);
    setValidationError(null);
    onClearError();
  }

  if (uploadedDocument) {
    return (
      <TransactionCandidateReviewPanel
        accounts={accounts}
        categories={categories}
        error={error}
        onConfirm={onConfirmCandidate}
        onClose={onClose}
        onGetReview={onGetReview}
        onReset={reset}
        onUpdate={onUpdateCandidate}
        panelId="transaction-camera-panel"
        tabId="transaction-camera-tab"
        uploadId={uploadedDocument.id}
      />
    );
  }

  const displayedError = validationError ?? error;

  return (
    <form
      aria-busy={isUploading}
      aria-labelledby="transaction-camera-tab"
      className="flex min-h-0 flex-1 flex-col"
      id="transaction-camera-panel"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div>
          <h3 className="text-sm font-semibold text-finhand-ink">
            Photograph a receipt
          </h3>
          <p className="mt-1 text-xs leading-5 text-finhand-muted">
            Use this device&apos;s rear camera. You can review or retake the
            photo before uploading it securely.
          </p>
        </div>

        <ReceiptCameraPicker
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
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {isUploading ? "Uploading…" : "Upload photo"}
        </Button>
      </div>
    </form>
  );
}
