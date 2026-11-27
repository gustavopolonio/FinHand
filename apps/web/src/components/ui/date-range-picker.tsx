"use client";

import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DayPicker,
  getDefaultClassNames,
  type DateRange,
} from "react-day-picker";

import { cn } from "@/lib/class-names";

import { Button } from "./button";
import {
  buildDateRangePresets,
  dateRangeFromValue,
  dateToInputValue,
  formatDateRangeLabel,
  rangesMatch,
  type DateRangeValue,
} from "./date-range-picker-data";

interface DateRangePickerProps {
  align?: "left" | "right";
  ariaLabel?: string;
  disabled?: boolean;
  onApply: (value: DateRangeValue) => void;
  triggerClassName?: string;
  value: DateRangeValue;
}

function draftRangeLabel(range: DateRange | undefined, isAllTime: boolean) {
  if (isAllTime) return "All time";
  if (!range?.from) return "Choose a start date";
  if (!range.to) return "Choose an end date";

  return formatDateRangeLabel({
    from: dateToInputValue(range.from),
    to: dateToInputValue(range.to),
  });
}

export function DateRangePicker({
  align = "left",
  ariaLabel = "Choose date range",
  disabled = false,
  onApply,
  triggerClassName,
  value,
}: DateRangePickerProps) {
  const panelId = useId();
  const [today] = useState(() => new Date());
  const presets = useMemo(() => buildDateRangePresets(today), [today]);
  const defaultClassNames = getDefaultClassNames();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAllTime, setIsAllTime] = useState(
    () => !value.from && !value.to,
  );
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    dateRangeFromValue(value),
  );
  const [month, setMonth] = useState(
    () => dateRangeFromValue(value)?.to ?? today,
  );

  const resetDraft = useCallback(() => {
    const appliedRange = dateRangeFromValue(value);
    setDraftRange(appliedRange);
    setIsAllTime(!appliedRange);
    setMonth(appliedRange?.to ?? appliedRange?.from ?? today);
  }, [today, value]);

  const closePicker = useCallback(
    (restoreFocus = false) => {
      setIsOpen(false);
      resetDraft();

      if (restoreFocus) {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    },
    [resetDraft],
  );

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        closePicker();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePicker, isOpen]);

  function togglePicker() {
    if (isOpen) {
      closePicker();
      return;
    }

    resetDraft();
    setIsOpen(true);
  }

  function selectPreset(range: DateRange | undefined) {
    setDraftRange(range);
    setIsAllTime(!range);

    if (range?.to) setMonth(range.to);
  }

  function applySelection() {
    if (isAllTime) {
      setIsOpen(false);
      onApply({});
      return;
    }

    if (!draftRange?.from || !draftRange.to) return;

    setIsOpen(false);
    onApply({
      from: dateToInputValue(draftRange.from),
      to: dateToInputValue(draftRange.to),
    });
  }

  function stopPanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const canApply = isAllTime || Boolean(draftRange?.from && draftRange.to);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex min-h-10 max-w-full items-center gap-2.5 rounded-lg border border-finhand-border bg-white px-3.5 text-left text-sm font-semibold text-finhand-ink shadow-finhand-card transition hover:border-finhand-accent-border hover:bg-finhand-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen &&
            "border-2 border-finhand-focus bg-finhand-accent-soft shadow-finhand-card",
          triggerClassName,
        )}
        disabled={disabled}
        onClick={togglePicker}
        ref={triggerRef}
        type="button"
      >
        <CalendarRange
          aria-hidden="true"
          className="size-4 shrink-0 text-finhand-interactive"
        />
        <span className="truncate">{formatDateRangeLabel(value)}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-finhand-subtle transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div
          aria-label={ariaLabel}
          className={cn(
            "absolute top-full z-50 mt-2 flex max-h-[calc(100vh-8rem)] w-[min(31rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-finhand-border bg-white shadow-xl shadow-slate-950/10",
            align === "right" ? "right-0" : "left-0",
          )}
          id={panelId}
          onPointerDown={stopPanelPointerDown}
          role="dialog"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
            <div className="order-2 border-t border-finhand-border p-2 sm:order-1 sm:w-36 sm:shrink-0 sm:border-r sm:border-t-0 sm:py-3">
              <p className="px-2 pb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-finhand-subtle">
                Quick select
              </p>
              <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
                {presets.map((preset) => {
                  const isSelected = preset.range
                    ? !isAllTime && rangesMatch(draftRange, preset.range)
                    : isAllTime;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus",
                        isSelected
                          ? "bg-finhand-accent-soft text-finhand-primary"
                          : "text-finhand-neutral hover:bg-finhand-canvas-muted hover:text-finhand-ink",
                      )}
                      key={preset.id}
                      onClick={() => selectPreset(preset.range)}
                      type="button"
                    >
                      <span>{preset.label}</span>
                      {isSelected ? (
                        <Check
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-finhand-interactive"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="order-1 min-w-0 flex-1 p-3 sm:order-2 sm:p-4">
              <DayPicker
                className="finhand-date-range mx-auto"
                classNames={{
                  button_next: `${defaultClassNames.button_next} rounded-lg text-finhand-muted hover:bg-finhand-canvas-muted hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus`,
                  button_previous: `${defaultClassNames.button_previous} rounded-lg text-finhand-muted hover:bg-finhand-canvas-muted hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus`,
                  caption_label: `${defaultClassNames.caption_label} text-sm font-bold text-finhand-ink`,
                  chevron: `${defaultClassNames.chevron} fill-none stroke-current`,
                  day: `${defaultClassNames.day} text-sm text-finhand-ink`,
                  day_button: `${defaultClassNames.day_button} text-sm font-medium transition-colors hover:bg-finhand-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-finhand-focus`,
                  disabled: `${defaultClassNames.disabled} cursor-not-allowed text-finhand-subtle`,
                  month: `${defaultClassNames.month} w-full`,
                  month_caption: `${defaultClassNames.month_caption} items-center justify-center`,
                  month_grid: `${defaultClassNames.month_grid} w-full`,
                  outside: `${defaultClassNames.outside} text-finhand-subtle`,
                  range_end: `${defaultClassNames.range_end} font-semibold`,
                  range_middle: `${defaultClassNames.range_middle} font-medium`,
                  range_start: `${defaultClassNames.range_start} font-semibold`,
                  selected: `${defaultClassNames.selected} text-sm font-semibold`,
                  today: `${defaultClassNames.today} font-bold text-finhand-interactive`,
                  weekday: `${defaultClassNames.weekday} text-[0.68rem] font-semibold uppercase text-finhand-subtle`,
                }}
                components={{
                  Chevron: ({ orientation }) =>
                    orientation === "left" ? (
                      <ChevronLeft aria-hidden="true" className="size-4" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="size-4" />
                    ),
                }}
                disabled={{ after: today }}
                endMonth={today}
                fixedWeeks
                mode="range"
                month={month}
                navLayout="around"
                onMonthChange={setMonth}
                onSelect={(range) => {
                  setDraftRange(range);
                  setIsAllTime(false);
                }}
                resetOnSelect
                selected={isAllTime ? undefined : draftRange}
                showOutsideDays
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-finhand-border bg-finhand-canvas/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className="min-w-0 truncate text-xs font-semibold text-finhand-muted sm:max-w-72"
              title={draftRangeLabel(draftRange, isAllTime)}
            >
              {draftRangeLabel(draftRange, isAllTime)}
            </p>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button onClick={() => closePicker(true)} size="sm" variant="ghost">
                Cancel
              </Button>
              <Button disabled={!canApply} onClick={applySelection} size="sm">
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
