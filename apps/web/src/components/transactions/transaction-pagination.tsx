import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../ui/button";

interface TransactionPaginationProps {
  hasMore: boolean;
  isLoading: boolean;
  itemCount: number;
  limit: number;
  offset: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function TransactionPagination({
  hasMore,
  isLoading,
  itemCount,
  limit,
  offset,
  onNext,
  onPrevious,
}: TransactionPaginationProps) {
  const page = Math.floor(offset / limit) + 1;

  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm text-finhand-muted">
        {itemCount > 0
          ? `Showing ${offset + 1}–${offset + itemCount}`
          : "No results on this page"}
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm font-semibold text-finhand-muted">
          Page {page}
        </span>
        <div className="flex gap-2">
          <Button
            aria-label="Previous page"
            disabled={isLoading || offset === 0}
            onClick={onPrevious}
            size="sm"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="hidden min-[390px]:inline">Previous</span>
          </Button>
          <Button
            aria-label="Next page"
            disabled={isLoading || !hasMore}
            onClick={onNext}
            size="sm"
            variant="secondary"
          >
            <span className="hidden min-[390px]:inline">Next</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
