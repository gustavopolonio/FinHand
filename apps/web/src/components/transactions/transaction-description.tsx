import { ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";

import type { Transaction } from "@/lib/api";

interface TransactionDescriptionProps {
  counterpartyFallback?: string;
  showDocumentOrigin?: boolean;
  transaction: Transaction;
}

export function TransactionDescription({
  counterpartyFallback,
  showDocumentOrigin = false,
  transaction,
}: TransactionDescriptionProps) {
  const TypeIcon =
    transaction.type === "income" ? ArrowDownLeft : ArrowUpRight;
  const counterparty = transaction.counterparty ?? counterpartyFallback;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          transaction.type === "income"
            ? "bg-finhand-income-soft text-finhand-income"
            : "bg-finhand-expense-soft text-finhand-expense"
        }`}
      >
        <TypeIcon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-bold text-finhand-ink"
          title={transaction.description}
        >
          {transaction.description}
        </p>
        {counterparty ? (
          <p
            className="mt-0.5 truncate text-xs text-finhand-muted"
            title={counterparty}
          >
            {counterparty}
          </p>
        ) : null}
        {showDocumentOrigin && transaction.origin === "document" ? (
          <span
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-finhand-interactive"
            title="Created from an uploaded document"
          >
            <FileText aria-hidden="true" className="size-3" />
            Imported
          </span>
        ) : null}
      </div>
    </div>
  );
}
