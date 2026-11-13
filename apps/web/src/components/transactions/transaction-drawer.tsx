"use client";

import { Check, Eye, FileText } from "lucide-react";
import { type FormEvent, useState } from "react";

import type {
  Account,
  Category,
  ConfirmTransactionCandidateInput,
  ConfirmTransactionCandidateResult,
  DocumentCaptureSession,
  DocumentCaptureSessionProgress,
  DocumentUpload,
  Transaction,
  TransactionCandidate,
  TransactionCandidateReview,
  TransactionDocumentSource,
  RejectTransactionCandidateResult,
  UpdateTransactionCandidateInput,
} from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Button } from "../ui/button";
import { WorkspaceModal } from "../ui/workspace-modal";
import { DocumentUploadForm } from "./document-upload-form";
import { DocumentSourcePreview } from "./document-source-preview";
import { QrCaptureForm } from "./qr-capture-form";
import { ReceiptCameraForm } from "./receipt-camera-form";
import { TransactionFields } from "./transaction-fields";
import {
  emptyTransactionForm,
  formValuesFromTransaction,
  resolveCreateFormValues,
  type TransactionFormValues,
} from "./transaction-form";
import {
  type TransactionCreationMode,
  TransactionMethodSelector,
} from "./transaction-method-selector";

interface TransactionDrawerProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  isSubmitting: boolean;
  isManagingCaptureSession: boolean;
  isUploadingDocument: boolean;
  initialCreationMode?: TransactionCreationMode;
  onCancelCaptureSession: (sessionId: string) => Promise<void>;
  onClearError: () => void;
  onClose: () => void;
  onConfirmCandidate: (
    candidateId: string,
    input: ConfirmTransactionCandidateInput,
  ) => Promise<ConfirmTransactionCandidateResult | null>;
  onCreateCaptureSession: () => Promise<DocumentCaptureSession | null>;
  onGetCaptureSessionProgress: (
    sessionId: string,
  ) => Promise<DocumentCaptureSessionProgress | null>;
  onGetCandidateReview: (
    uploadId: string,
  ) => Promise<TransactionCandidateReview | null>;
  onGetTransactionDocumentSource: (
    transactionId: string,
  ) => Promise<TransactionDocumentSource>;
  onRejectCandidate: (
    candidateId: string,
  ) => Promise<RejectTransactionCandidateResult | null>;
  onSubmit: (values: TransactionFormValues) => Promise<boolean>;
  onUploadDocument: (file: File) => Promise<DocumentUpload | null>;
  onUpdateCandidate: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
  transaction: Transaction | null;
}

export function TransactionDrawer({
  accounts,
  categories,
  error,
  isSubmitting,
  isManagingCaptureSession,
  isUploadingDocument,
  initialCreationMode = "manual",
  onCancelCaptureSession,
  onClearError,
  onClose,
  onConfirmCandidate,
  onCreateCaptureSession,
  onGetCaptureSessionProgress,
  onGetCandidateReview,
  onGetTransactionDocumentSource,
  onRejectCandidate,
  onSubmit,
  onUploadDocument,
  onUpdateCandidate,
  transaction,
}: TransactionDrawerProps) {
  const [creationMode, setCreationMode] =
    useState<TransactionCreationMode>(initialCreationMode);
  const [isShowingSourceDocument, setIsShowingSourceDocument] =
    useState(false);
  const [values, setValues] = useState(() =>
    transaction
      ? formValuesFromTransaction(transaction)
      : emptyTransactionForm(),
  );
  const availableAccounts = accounts.filter(
    (account) => !account.archivedAt || account.id === transaction?.accountId,
  );
  const availableCategories = categories.filter(
    (category) =>
      !category.archivedAt || category.id === transaction?.categoryId,
  );
  const resolvedValues = transaction
    ? values
    : resolveCreateFormValues(
        values,
        availableAccounts,
        availableCategories,
      );
  const isDocumentTransaction = transaction?.origin === "document";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await onSubmit(resolvedValues)) {
      onClose();
    }
  }

  const isBusy =
    isSubmitting || isUploadingDocument || isManagingCaptureSession;
  const description = transaction
    ? "Adjust the details saved for this transaction."
    : creationMode === "manual"
      ? "Record a new expense or income to your ledger."
      : creationMode === "document"
        ? "Upload a receipt or invoice securely from this device."
        : creationMode === "camera"
          ? "Photograph and securely upload a receipt from this device."
          : "Securely continue receipt capture on your phone.";

  return (
    <WorkspaceModal
      description={description}
      isBusy={isBusy}
      onClose={onClose}
      title={transaction ? "Edit Transaction" : "Add Transaction"}
      widthClassName={
        isDocumentTransaction && isShowingSourceDocument
          ? "max-w-[1040px]"
          : !transaction && creationMode !== "manual"
            ? "max-w-[1040px]"
            : undefined
      }
    >
      {!transaction ? (
        <div className="border-b border-finhand-divider px-6 py-4">
          <TransactionMethodSelector
            disabled={isBusy}
            onChange={(mode) => {
              setCreationMode(mode);
              onClearError();
            }}
            value={creationMode}
          />
        </div>
      ) : null}

      {!transaction && creationMode === "document" ? (
        <DocumentUploadForm
          accounts={availableAccounts}
          categories={availableCategories}
          error={error}
          isUploading={isUploadingDocument}
          onClearError={onClearError}
          onClose={onClose}
          onConfirmCandidate={onConfirmCandidate}
          onGetReview={onGetCandidateReview}
          onRejectCandidate={onRejectCandidate}
          onUpdateCandidate={onUpdateCandidate}
          onUpload={onUploadDocument}
        />
      ) : !transaction && creationMode === "camera" ? (
        <ReceiptCameraForm
          accounts={availableAccounts}
          categories={availableCategories}
          error={error}
          isUploading={isUploadingDocument}
          onClearError={onClearError}
          onClose={onClose}
          onConfirmCandidate={onConfirmCandidate}
          onGetReview={onGetCandidateReview}
          onRejectCandidate={onRejectCandidate}
          onUpdateCandidate={onUpdateCandidate}
          onUpload={onUploadDocument}
        />
      ) : !transaction && creationMode === "qr" ? (
        <QrCaptureForm
          accounts={availableAccounts}
          categories={availableCategories}
          error={error}
          isManaging={isManagingCaptureSession}
          onCancel={onCancelCaptureSession}
          onClearError={onClearError}
          onClose={onClose}
          onConfirmCandidate={onConfirmCandidate}
          onCreate={onCreateCaptureSession}
          onGetProgress={onGetCaptureSessionProgress}
          onGetReview={onGetCandidateReview}
          onRejectCandidate={onRejectCandidate}
          onUpdateCandidate={onUpdateCandidate}
        />
      ) : (
        <div
          className={cn(
            "min-h-0 flex-1",
            isDocumentTransaction && isShowingSourceDocument
              ? "grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              : "flex flex-col",
          )}
        >
          {transaction && isDocumentTransaction && isShowingSourceDocument ? (
            <DocumentSourcePreview
              onHide={() => setIsShowingSourceDocument(false)}
              onLoad={onGetTransactionDocumentSource}
              sourceId={transaction.id}
            />
          ) : null}

          <form
            aria-labelledby={
              transaction ? undefined : "transaction-manual-tab"
            }
            className="flex min-h-0 flex-1 flex-col"
            id={transaction ? undefined : "transaction-manual-panel"}
            key="transaction-form"
            onSubmit={(event) => void submit(event)}
          >
            <div className="flex-1 overflow-y-auto p-6">
              <TransactionFields
                accounts={availableAccounts}
                categories={availableCategories}
                onChange={setValues}
                values={resolvedValues}
              />

              {transaction &&
                isDocumentTransaction &&
                !isShowingSourceDocument ? (
                <section className="mt-5 flex items-center gap-4 rounded-xl border border-finhand-accent-border bg-finhand-accent-soft p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-finhand-interactive">
                    <FileText aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-finhand-ink">
                      Imported from a document
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-finhand-muted">
                      View the receipt or invoice used to create this
                      transaction.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsShowingSourceDocument(true)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    View original
                  </Button>
                </section>
              ) : null}

              {error ? (
                <p
                  className="mt-4 rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              {!transaction && availableAccounts.length === 0 ? (
                <p className="mt-4 rounded-lg bg-finhand-warning-soft px-4 py-3 text-sm text-finhand-warning">
                  Create or restore an account before adding a transaction.
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
              <Button
                className="rounded-xl!"
                disabled={isSubmitting}
                onClick={onClose}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl!"
                disabled={isSubmitting || availableAccounts.length === 0}
                type="submit"
              >
                {!isSubmitting ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : null}
                {isSubmitting
                  ? "Saving…"
                  : transaction
                    ? "Save Changes"
                    : "Save Transaction"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceModal>
  );
}
