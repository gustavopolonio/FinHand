"use client";

import { FileX2 } from "lucide-react";

import type { TransactionCandidate } from "@/lib/api";

import { ConfirmModal } from "../ui/confirm-modal";

interface TransactionCandidateRejectModalProps {
  candidate: TransactionCandidate;
  error: string | null;
  isRejecting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TransactionCandidateRejectModal({
  candidate,
  error,
  isRejecting,
  onCancel,
  onConfirm,
}: TransactionCandidateRejectModalProps) {
  return (
    <ConfirmModal
      cancelLabel="Keep candidate"
      confirmIcon={<FileX2 aria-hidden="true" className="size-4" />}
      confirmLabel="Discard candidate"
      confirmingLabel="Discarding…"
      description="Discard this extracted candidate? It will be removed from pending review without creating a transaction or changing your balances."
      error={error}
      eyebrow="Confirm discard"
      icon={<FileX2 aria-hidden="true" className="size-6" />}
      isConfirming={isRejecting}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Discard candidate"
    >
      <div className="rounded-xl border border-finhand-border bg-finhand-canvas-muted p-5">
        <p className="text-sm font-semibold text-finhand-ink">
          {candidate.description?.trim() || "Untitled transaction candidate"}
        </p>
        <p className="mt-1 text-xs leading-5 text-finhand-muted">
          {candidate.counterparty?.trim() ||
            "No counterparty was identified for this candidate."}
        </p>
      </div>
    </ConfirmModal>
  );
}
