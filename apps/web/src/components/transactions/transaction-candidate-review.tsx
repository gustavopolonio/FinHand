"use client";

import {
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  Account,
  Category,
  TransactionCandidate,
  TransactionCandidateReview,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import { DocumentSourcePreview } from "./document-source-preview";
import { TransactionCandidateEditor } from "./transaction-candidate-editor";

interface TransactionCandidateReviewPanelProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  onClose: () => void;
  onGetReview: (
    uploadId: string,
  ) => Promise<TransactionCandidateReview | null>;
  onReset?: () => void;
  onUpdate: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
  panelId: string;
  tabId?: string;
  uploadId: string;
}

const pollingIntervalMilliseconds = 2_000;

export function shouldPollCandidateReview(
  review: TransactionCandidateReview | null,
): boolean {
  return (
    review === null ||
    review.upload.status === "pending" ||
    review.upload.status === "uploaded" ||
    review.upload.status === "processing"
  );
}

export function TransactionCandidateReviewPanel({
  accounts,
  categories,
  error,
  onClose,
  onGetReview,
  onReset,
  onUpdate,
  panelId,
  tabId,
  uploadId,
}: TransactionCandidateReviewPanelProps) {
  const [review, setReview] = useState<TransactionCandidateReview | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function readReview() {
      const nextReview = await onGetReview(uploadId);
      if (!active) return;

      if (!nextReview) {
        timeoutId = setTimeout(
          () => void readReview(),
          pollingIntervalMilliseconds,
        );
        return;
      }

      setReview(nextReview);

      if (shouldPollCandidateReview(nextReview)) {
        timeoutId = setTimeout(
          () => void readReview(),
          pollingIntervalMilliseconds,
        );
      }
    }

    void readReview();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onGetReview, uploadId]);

  const candidate = review?.candidates[activeIndex];

  function replaceCandidate(updatedCandidate: TransactionCandidate) {
    setReview((currentReview) =>
      currentReview
        ? {
            ...currentReview,
            candidates: currentReview.candidates.map((item) =>
              item.id === updatedCandidate.id ? updatedCandidate : item,
            ),
          }
        : currentReview,
    );
  }

  if (review?.upload.status === "processed" && candidate) {
    return (
      <div
        aria-labelledby={tabId}
        className="flex min-h-0 flex-1 flex-col"
        id={panelId}
      >
        <div className="flex items-center justify-between border-b border-finhand-divider px-6 py-3">
          <div>
            <p className="text-xs font-semibold text-finhand-interactive">
              Review extracted transaction
            </p>
            <p className="mt-0.5 max-w-xs truncate text-xs text-finhand-muted">
              {review.upload.originalFileName}
            </p>
          </div>
          {review.candidates.length > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                aria-label="Previous candidate"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((index) => index - 1)}
                size="sm"
                variant="secondary"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <span className="text-xs font-semibold text-finhand-muted">
                {activeIndex + 1} of {review.candidates.length}
              </span>
              <Button
                aria-label="Next candidate"
                disabled={activeIndex === review.candidates.length - 1}
                onClick={() => setActiveIndex((index) => index + 1)}
                size="sm"
                variant="secondary"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <DocumentSourcePreview
            fileName={review.upload.originalFileName}
            uploadId={review.upload.id}
          />
          <TransactionCandidateEditor
            accounts={accounts}
            candidate={candidate}
            categories={categories}
            error={error}
            key={candidate.id}
            onClose={onClose}
            onSave={onUpdate}
            onSaved={replaceCandidate}
          />
        </div>
      </div>
    );
  }

  const failed = review?.upload.status === "failed";
  const processedWithoutCandidates =
    review?.upload.status === "processed" && review.candidates.length === 0;

  return (
    <div
      aria-labelledby={tabId}
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col"
      id={panelId}
    >
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center">
        <span
          className={`grid size-16 place-items-center rounded-full ${
            failed || processedWithoutCandidates
              ? "bg-finhand-expense-soft text-finhand-expense"
              : "bg-finhand-accent-soft text-finhand-interactive"
          }`}
        >
          {failed || processedWithoutCandidates ? (
            <CircleAlert aria-hidden="true" className="size-8" />
          ) : review?.upload.status === "processing" ? (
            <FileSearch aria-hidden="true" className="size-8" />
          ) : (
            <LoaderCircle aria-hidden="true" className="size-8 animate-spin" />
          )}
        </span>
        <h3 className="mt-5 text-lg font-bold text-finhand-ink">
          {failed
            ? "Document processing failed"
            : processedWithoutCandidates
              ? "No candidates were found"
              : review?.upload.status === "processing"
                ? "Analyzing your document"
                : "Document queued for analysis"}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-finhand-muted">
          {failed || processedWithoutCandidates
            ? "We could not prepare this document for review. You can try another file."
            : "You can keep this window open. The extracted draft will appear here automatically."}
        </p>
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
        {onReset && (failed || processedWithoutCandidates) ? (
          <Button className="rounded-xl!" onClick={onReset} variant="secondary">
            <RotateCcw aria-hidden="true" className="size-4" />
            Try another
          </Button>
        ) : null}
        <Button className="rounded-xl!" onClick={onClose} variant="ghost">
          Close
        </Button>
      </div>
    </div>
  );
}
