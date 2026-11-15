"use client";

import {
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { DocumentImportIssue } from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Button } from "../ui/button";

interface DocumentImportIssuesSectionProps {
  dismissingUploadId: string | null;
  onDismiss: (uploadId: string) => Promise<boolean>;
  onLoad: () => Promise<DocumentImportIssue[] | null>;
  onRetry: (uploadId: string) => Promise<boolean>;
  onUploadAnother: () => void;
  refreshKey: number;
  retryingUploadId: string | null;
}

interface DocumentImportIssueRowsProps {
  dismissingUploadId: string | null;
  issues: DocumentImportIssue[];
  onDismiss: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
  onUploadAnother: () => void;
  retryingUploadId: string | null;
}

type DocumentImportIssuesListProps = DocumentImportIssueRowsProps;

const expandedPreferenceKey = "finhand:document-import-issues-expanded";

function formatFailedAt(failedAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(failedAt));
}

export function DocumentImportIssueRows({
  dismissingUploadId,
  issues,
  onDismiss,
  onRetry,
  onUploadAnother,
  retryingUploadId,
}: DocumentImportIssueRowsProps) {
  const isBusy = retryingUploadId !== null || dismissingUploadId !== null;

  return (
    <ul className="divide-y divide-finhand-divider">
      {issues.map((issue) => (
        <li className="flex items-center gap-4 px-5 py-4" key={issue.uploadId}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-finhand-expense-soft text-finhand-expense">
            <CircleAlert aria-hidden="true" className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-finhand-ink">
              {issue.originalFileName}
            </p>
            <p className="mt-0.5 text-xs text-finhand-muted">
              <time dateTime={issue.failedAt} suppressHydrationWarning>
                Failed {formatFailedAt(issue.failedAt)}
              </time>
              <span aria-hidden="true"> · </span>
              <span>{issue.failure.message}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              disabled={isBusy}
              onClick={() => onDismiss(issue.uploadId)}
              size="sm"
              variant="ghost"
            >
              {dismissingUploadId === issue.uploadId ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <X aria-hidden="true" className="size-4" />
              )}
              {dismissingUploadId === issue.uploadId ? "Dismissing" : "Dismiss"}
            </Button>

            {issue.failure.canRetry ? (
              <Button
                disabled={isBusy}
                onClick={() => onRetry(issue.uploadId)}
                size="sm"
                variant="secondary"
              >
                {retryingUploadId === issue.uploadId ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" className="size-4" />
                )}
                {retryingUploadId === issue.uploadId
                  ? "Retrying"
                  : "Retry processing"}
              </Button>
            ) : (
              <Button
                disabled={isBusy}
                onClick={onUploadAnother}
                size="sm"
                variant="secondary"
              >
                <Upload aria-hidden="true" className="size-4" />
                Upload another
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DocumentImportIssuesList({
  dismissingUploadId,
  issues,
  onDismiss,
  onRetry,
  onUploadAnother,
  retryingUploadId,
}: DocumentImportIssuesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const retryableCount = issues.filter((issue) => issue.failure.canRetry).length;

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

  return (
    <section
      aria-labelledby="document-import-issues-title"
      className="overflow-hidden rounded-2xl border border-finhand-expense/20 bg-white shadow-finhand-card"
    >
      <button
        aria-controls="document-import-issues-list"
        aria-expanded={isExpanded}
        className="flex w-full min-w-0 items-center gap-3 bg-finhand-expense-soft/60 px-5 py-4 text-left"
        onClick={toggleExpanded}
        type="button"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-finhand-expense">
          <CircleAlert aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className="text-sm font-bold text-finhand-ink"
              id="document-import-issues-title"
            >
              Import issues
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-finhand-expense">
              {issues.length}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-finhand-muted">
            {issues.length === 1
              ? "1 document import needs your attention"
              : `${issues.length} document imports need your attention`}
            {retryableCount > 0
              ? ` · ${retryableCount} can be retried`
              : ""}
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

      {isExpanded ? (
        <div
          className="max-h-[360px] overflow-y-auto overscroll-contain"
          id="document-import-issues-list"
        >
          <DocumentImportIssueRows
            dismissingUploadId={dismissingUploadId}
            issues={issues}
            onDismiss={onDismiss}
            onRetry={onRetry}
            onUploadAnother={onUploadAnother}
            retryingUploadId={retryingUploadId}
          />
        </div>
      ) : null}
    </section>
  );
}

export function DocumentImportIssuesSection({
  dismissingUploadId,
  onDismiss,
  onLoad,
  onRetry,
  onUploadAnother,
  refreshKey,
  retryingUploadId,
}: DocumentImportIssuesSectionProps) {
  const [issues, setIssues] = useState<DocumentImportIssue[] | null>(null);

  useEffect(() => {
    let active = true;

    void onLoad().then((nextIssues) => {
      if (active && nextIssues) setIssues(nextIssues);
    });

    return () => {
      active = false;
    };
  }, [onLoad, refreshKey]);

  async function dismissIssue(uploadId: string) {
    if (await onDismiss(uploadId)) {
      setIssues((currentIssues) =>
        currentIssues?.filter((issue) => issue.uploadId !== uploadId) ?? null,
      );
    }
  }

  async function retryIssue(uploadId: string) {
    if (await onRetry(uploadId)) {
      setIssues((currentIssues) =>
        currentIssues?.filter((issue) => issue.uploadId !== uploadId) ?? null,
      );
    }
  }

  if (!issues || issues.length === 0) return null;

  return (
    <DocumentImportIssuesList
      dismissingUploadId={dismissingUploadId}
      issues={issues}
      onDismiss={(uploadId) => void dismissIssue(uploadId)}
      onRetry={(uploadId) => void retryIssue(uploadId)}
      onUploadAnother={onUploadAnother}
      retryingUploadId={retryingUploadId}
    />
  );
}
