"use client";

import {
  ChevronDown,
  Clock3,
  FileCheck2,
  FileSearch,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { DocumentReview } from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Button } from "../ui/button";

interface DocumentReviewsSectionProps {
  onLoad: () => Promise<DocumentReview[] | null>;
  onMissingReview: (uploadId: string) => Promise<void>;
  onOpenReview: (uploadId: string) => void;
  refreshKey: number;
}

interface DocumentReviewRowsProps {
  onOpenReview: (uploadId: string) => void;
  reviews: DocumentReview[];
}

type DocumentReviewsListProps = DocumentReviewRowsProps;

const pollingIntervalMilliseconds = 2_000;
const expandedPreferenceKey = "finhand:pending-documents-expanded";

function isProcessing(review: DocumentReview): boolean {
  return (
    review.status === "pending" ||
    review.status === "uploaded" ||
    review.status === "processing"
  );
}

export function shouldPollDocumentReviews(reviews: DocumentReview[]): boolean {
  return reviews.some(isProcessing);
}

function formatCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function reviewPresentation(review: DocumentReview) {
  switch (review.status) {
    case "processed":
      return {
        Icon: FileCheck2,
        label:
          review.pendingCandidateCount === 1
            ? "1 candidate ready for review"
            : `${review.pendingCandidateCount} candidates ready for review`,
        tone: "ready" as const,
      };
    case "processing":
      return {
        Icon: FileSearch,
        label: "Analyzing document",
        tone: "processing" as const,
      };
    default:
      return {
        Icon: Clock3,
        label: "Waiting for analysis",
        tone: "waiting" as const,
      };
  }
}

export function DocumentReviewRows({
  onOpenReview,
  reviews,
}: DocumentReviewRowsProps) {
  return (
    <ul className="divide-y divide-finhand-divider">
      {reviews.map((review) => {
        const presentation = reviewPresentation(review);
        const Icon = presentation.Icon;

        return (
          <li
            className={cn(
              "flex items-center gap-4 px-5 py-4",
              presentation.tone === "ready" && "bg-finhand-warning-soft/40",
            )}
            key={review.uploadId}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                presentation.tone === "ready" &&
                  "bg-finhand-warning-soft text-finhand-warning",
                (presentation.tone === "processing" ||
                  presentation.tone === "waiting") &&
                  "bg-finhand-accent-soft text-finhand-interactive",
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-finhand-ink">
                {review.originalFileName}
              </p>
              <p className="mt-0.5 text-xs text-finhand-muted">
                <time dateTime={review.createdAt} suppressHydrationWarning>
                  Created {formatCreatedAt(review.createdAt)}
                </time>
                <span aria-hidden="true"> · </span>
                <span
                  className={cn(
                    "font-medium",
                    presentation.tone === "ready" && "text-finhand-warning",
                  )}
                >
                  {presentation.label}
                </span>
              </p>
            </div>

            {review.status === "processed" ? (
              <Button
                onClick={() => onOpenReview(review.uploadId)}
                size="sm"
              >
                Review
              </Button>
            ) : (
              <span className="text-xs text-finhand-muted">In progress</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DocumentReviewsList({
  onOpenReview,
  reviews,
}: DocumentReviewsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const readyReviews = reviews.filter(
    (review) => review.status === "processed",
  );
  const processingCount = reviews.filter(isProcessing).length;
  const nextReview = [...readyReviews].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  )[0];
  const summary = [
    readyReviews.length > 0
      ? readyReviews.length === 1
        ? "1 transaction needs your review"
        : `${readyReviews.length} transactions need your review`
      : null,
    processingCount > 0 ? `${processingCount} processing` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsExpanded(sessionStorage.getItem(expandedPreferenceKey) === "true");
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  function toggleExpanded() {
    setIsExpanded((expanded) => {
      const nextExpanded = !expanded;
      sessionStorage.setItem(expandedPreferenceKey, String(nextExpanded));
      return nextExpanded;
    });
  }

  function openReview(uploadId: string) {
    onOpenReview(uploadId);
  }

  return (
    <section
      aria-labelledby="pending-document-reviews-title"
      className="overflow-hidden rounded-2xl border border-finhand-accent-border bg-white shadow-finhand-card"
    >
      <div className="relative bg-finhand-accent-soft">
        <button
          aria-controls="pending-document-reviews-list"
          aria-expanded={isExpanded}
          className={cn(
            "flex min-h-full w-full min-w-0 items-center gap-3 px-5 py-4 text-left",
            nextReview && "pr-40",
          )}
          onClick={toggleExpanded}
          type="button"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-finhand-interactive">
            {shouldPollDocumentReviews(reviews) ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileCheck2 aria-hidden="true" className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className="text-sm font-bold text-finhand-ink"
                id="pending-document-reviews-title"
              >
                Pending transactions
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-finhand-interactive">
                {reviews.length}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-finhand-muted">
              {summary}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-finhand-muted transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>

        {nextReview ? (
          <Button
            className="absolute right-5 top-1/2 z-10 -translate-y-1/2"
            onClick={() => openReview(nextReview.uploadId)}
            size="sm"
          >
            Review next
          </Button>
        ) : null}
      </div>

      {isExpanded ? (
        <div
          className="max-h-[360px] overflow-y-auto overscroll-contain"
          id="pending-document-reviews-list"
        >
          <DocumentReviewRows onOpenReview={openReview} reviews={reviews} />
        </div>
      ) : null}
    </section>
  );
}

export function DocumentReviewsSection({
  onLoad,
  onMissingReview,
  onOpenReview,
  refreshKey,
}: DocumentReviewsSectionProps) {
  const [reviews, setReviews] = useState<DocumentReview[] | null>(null);
  const previousReviewsRef = useRef<DocumentReview[]>([]);

  useEffect(() => {
    let active = true;
    let isReading = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function clearScheduledPoll() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    function schedulePoll() {
      clearScheduledPoll();
      if (document.visibilityState === "visible") {
        timeoutId = setTimeout(
          () => void readReviews(),
          pollingIntervalMilliseconds,
        );
      }
    }

    async function readReviews() {
      if (!active || isReading || document.visibilityState !== "visible") {
        return;
      }

      isReading = true;
      const nextReviews = await onLoad();
      isReading = false;

      if (!active) return;

      if (nextReviews) {
        const nextReviewIds = new Set(
          nextReviews.map((review) => review.uploadId),
        );
        const missingProcessingReviews = previousReviewsRef.current.filter(
          (review) =>
            isProcessing(review) && !nextReviewIds.has(review.uploadId),
        );

        previousReviewsRef.current = nextReviews;
        setReviews(nextReviews);

        for (const missingReview of missingProcessingReviews) {
          void onMissingReview(missingReview.uploadId);
        }
      }

      if (nextReviews === null || shouldPollDocumentReviews(nextReviews)) {
        schedulePoll();
      }
    }

    function handleVisibilityChange() {
      clearScheduledPoll();

      if (document.visibilityState === "visible") {
        void readReviews();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void readReviews();

    return () => {
      active = false;
      clearScheduledPoll();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onLoad, onMissingReview, refreshKey]);

  if (!reviews || reviews.length === 0) return null;

  return (
    <DocumentReviewsList
      onOpenReview={onOpenReview}
      reviews={reviews}
    />
  );
}
