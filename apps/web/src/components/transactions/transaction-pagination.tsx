interface TransactionPaginationProps {
  hasMore: boolean;
  isLoading: boolean;
  itemCount: number;
  offset: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function TransactionPagination({
  hasMore,
  isLoading,
  itemCount,
  offset,
  onNext,
  onPrevious,
}: TransactionPaginationProps) {
  return (
    <div className="mt-5 flex items-center justify-between gap-4">
      <p className="text-sm text-slate-600">
        {itemCount > 0
          ? `Showing ${offset + 1}–${offset + itemCount}`
          : "No results on this page"}
      </p>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          disabled={isLoading || offset === 0}
          onClick={onPrevious}
          type="button"
        >
          Previous
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          disabled={isLoading || !hasMore}
          onClick={onNext}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
