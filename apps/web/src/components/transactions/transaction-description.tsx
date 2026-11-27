import { FileText } from "lucide-react";

import type { Transaction } from "@/lib/api";

import { TransactionTypeIcon } from "./transaction-type-icon";

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
  const counterparty = transaction.counterparty ?? counterpartyFallback;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <TransactionTypeIcon type={transaction.type} />
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
