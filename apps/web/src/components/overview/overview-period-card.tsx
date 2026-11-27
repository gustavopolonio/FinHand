import { DateRangePicker } from "../ui/date-range-picker";
import type { DateRangeValue } from "../ui/date-range-picker-data";
import { DollarMarketIndicator } from "./dollar-market-indicator";

interface OverviewPeriodCardProps {
  filters: DateRangeValue;
  isLoading: boolean;
  onApplyPeriod: (value: DateRangeValue) => void;
}

export function OverviewPeriodCard({
  filters,
  isLoading,
  onApplyPeriod,
}: OverviewPeriodCardProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <DateRangePicker
        disabled={isLoading}
        onApply={onApplyPeriod}
        value={filters}
      />
      <DollarMarketIndicator />
    </div>
  );
}
