"use client";

import {
  ExternalLink,
  FileWarning,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  type DocumentPreview,
  getAudioPreview,
  getDocumentPreview,
  type UploadKind,
} from "@/lib/api";

import { Button } from "../ui/button";

interface DocumentSourcePreviewProps {
  fileName?: string;
  onHide?: () => void;
  onLoad?: (
    sourceId: string,
  ) => Promise<DocumentPreview & { fileName?: string }>;
  sourceId: string;
  sourceKind?: UploadKind;
}

interface DocumentPreviewContentProps {
  fileName: string;
  preview: DocumentPreview;
}

export function documentPreviewKind(
  contentType: string,
): "audio" | "image" | "pdf" | "unsupported" {
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  return "unsupported";
}

export function DocumentPreviewContent({
  fileName,
  preview,
}: DocumentPreviewContentProps) {
  const kind = documentPreviewKind(preview.contentType);

  if (kind === "image") {
    return (
      // The signed S3 host is dynamic, so Next Image optimization is not used.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`Uploaded document ${fileName}`}
        className="h-full max-h-[620px] w-full object-contain"
        referrerPolicy="no-referrer"
        src={preview.url}
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        className="h-full min-h-[480px] w-full border-0"
        referrerPolicy="no-referrer"
        src={preview.url}
        title={`Uploaded document ${fileName}`}
      />
    );
  }

  if (kind === "audio") {
    return (
      <div className="flex h-full min-h-64 w-full items-center justify-center p-8">
        <audio
          aria-label={`Original recording ${fileName}`}
          className="w-full max-w-md"
          controls
          preload="metadata"
          src={preview.url}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center">
      <FileWarning aria-hidden="true" className="size-10 text-finhand-muted" />
      <p className="mt-3 text-sm font-semibold text-finhand-ink">
        Preview unavailable for this file type
      </p>
      <a
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-finhand-interactive hover:underline"
        href={preview.url}
        referrerPolicy="no-referrer"
        rel="noreferrer"
        target="_blank"
      >
        Open document
        <ExternalLink aria-hidden="true" className="size-4" />
      </a>
    </div>
  );
}

export function DocumentSourcePreview({
  fileName,
  onHide,
  onLoad,
  sourceId,
  sourceKind = "document",
}: DocumentSourcePreviewProps) {
  const [preview, setPreview] = useState<
    (DocumentPreview & { fileName?: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      try {
        const loadPreview =
          onLoad ??
          (sourceKind === "audio" ? getAudioPreview : getDocumentPreview);
        const nextPreview = await loadPreview(sourceId);
        if (!active) return;

        setPreview(nextPreview);
        setError(null);
      } catch {
        if (!active) return;

        setPreview(null);
        setError(
          sourceKind === "audio"
            ? "The original recording could not be loaded."
            : "The original document could not be loaded.",
        );
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [onLoad, requestVersion, sourceId, sourceKind]);

  const resolvedFileName =
    preview?.fileName ??
    fileName ??
    (sourceKind === "audio" ? "Voice recording" : "Source document");
  const sourceLabel = sourceKind === "audio" ? "recording" : "document";

  return (
    <section className="flex min-h-0 min-w-0 flex-col border-b border-finhand-divider bg-finhand-canvas-muted lg:border-r lg:border-b-0">
      <header className="flex items-center justify-between gap-3 border-b border-finhand-divider bg-white px-5 py-3">
        <p className="text-xs font-semibold text-finhand-ink">
          Original {sourceLabel}
        </p>
        <div className="flex items-center gap-2">
          {onHide ? (
            <Button onClick={onHide} size="sm" variant="ghost">
              Hide original
            </Button>
          ) : null}
          {preview ? (
            <a
              aria-label={`Open original ${sourceLabel} in a new tab`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-finhand-muted transition hover:bg-finhand-accent-soft hover:text-finhand-interactive"
              href={preview.url}
              referrerPolicy="no-referrer"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-80 flex-1 items-center justify-center overflow-hidden p-4 lg:min-h-0">
        {error ? (
          <div className="max-w-xs text-center">
            <FileWarning
              aria-hidden="true"
              className="mx-auto size-10 text-finhand-expense"
            />
            <p className="mt-3 text-sm text-finhand-muted" role="alert">
              {error}
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setError(null);
                setRequestVersion((version) => version + 1);
              }}
              size="sm"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </Button>
          </div>
        ) : preview ? (
          <DocumentPreviewContent
            fileName={resolvedFileName}
            preview={preview}
          />
        ) : (
          <div className="text-center" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto size-8 animate-spin text-finhand-interactive"
            />
            <p className="mt-3 text-xs font-medium text-finhand-muted">
              Loading original {sourceLabel}…
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
