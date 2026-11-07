import { CheckCircle2 } from "lucide-react";

import type { DocumentUpload } from "@/lib/api";

import { Button } from "../ui/button";

interface DocumentUploadSuccessProps {
  document: DocumentUpload;
  onClose: () => void;
  onUploadAnother: () => void;
  panelId: string;
  tabId: string;
}

export function DocumentUploadSuccess({
  document,
  onClose,
  onUploadAnother,
  panelId,
  tabId,
}: DocumentUploadSuccessProps) {
  return (
    <div
      aria-labelledby={tabId}
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col"
      id={panelId}
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
            {document.originalFileName}
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
          onClick={onUploadAnother}
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
