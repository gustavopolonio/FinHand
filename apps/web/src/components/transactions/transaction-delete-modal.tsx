"use client";

import { ReceiptText, Trash2 } from "lucide-react";

import type { Transaction } from "@/lib/api";

import { ConfirmModal } from "../ui/confirm-modal";
import { CurrencyAmount } from "../ui/currency-amount";

interface TransactionDeleteModalProps {
  accountName: string;
  categoryName: string;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  transaction: Transaction;
}

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function signedAmount(transaction: Transaction) {
  return transaction.type === "expense"
    ? `-${transaction.amountMinor}`
    : transaction.amountMinor;
}

export function TransactionDeleteModal({
  accountName,
  categoryName,
  error,
  isDeleting,
  onCancel,
  onConfirm,
  transaction,
}: TransactionDeleteModalProps) {
  const transactionLabel =
    transaction.type === "expense" ? "Debit" : "Credit";
  const amountColor =
    transaction.type === "expense"
      ? "text-[#88211c]"
      : "text-finhand-income";

  return (
    <ConfirmModal
      cancelLabel="Keep transaction"
      confirmIcon={<Trash2 aria-hidden="true" className="size-4" />}
      confirmLabel="Delete entry"
      description="Are you sure you want to permanently remove this transaction? This action cannot be reversed and will automatically update your ledger history."
      error={error}
      eyebrow="Confirm removal"
      icon={<Trash2 aria-hidden="true" className="size-6" />}
      isConfirming={isDeleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Delete transaction"
    >
      <div className="rounded-xl bg-finhand-mint-soft/70 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#88211c] shadow-sm">
              <ReceiptText aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-finhand-ink">
                {transaction.description}
              </p>
              <p className="mt-0.5 truncate text-xs text-finhand-muted">
                {transaction.counterparty ?? "No counterparty"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <CurrencyAmount
              className={`text-[22px] font-semibold leading-7 tracking-[-0.02em] ${amountColor}`}
              currencyCode={transaction.currencyCode}
              value={signedAmount(transaction)}
            />
            <p
              className={`mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${amountColor}`}
            >
              {transactionLabel}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-1">
          <div className="min-w-0 rounded-lg bg-white/80 px-3 py-2">
            <dt className="text-[11px] font-medium text-finhand-subtle">Date</dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-finhand-ink">
              {formatTransactionDate(transaction.occurredOn)}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-white/80 px-3 py-2">
            <dt className="text-[11px] font-medium text-finhand-subtle">
              Account
            </dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-finhand-ink">
              {accountName}
            </dd>
          </div>
          <div className="min-w-0 rounded-lg bg-white/80 px-3 py-2">
            <dt className="text-[11px] font-medium text-finhand-subtle">
              Category
            </dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-finhand-ink">
              {categoryName}
            </dd>
          </div>
        </dl>
      </div>
    </ConfirmModal>
  );
}
