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

import { cn } from "@/lib/class-names";

import { Button } from "./button";
import {
  createMonthValue,
  formatMonthValue,
  parseMonthValue,
} from "./month-picker-data";

interface MonthPickerProps {
  ariaLabel?: string;
  disabled?: boolean;
  onApply: (value: string) => void;
  value: string;
}

const monthNames = Array.from({ length: 12 }, (_, monthIndex) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, monthIndex, 1))),
);

export function MonthPicker({
  ariaLabel = "Choose month",
  disabled = false,
  onApply,
  value,
}: MonthPickerProps) {
  const panelId = useId();
  const [today] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [displayedYear, setDisplayedYear] = useState(
    () => parseMonthValue(value)?.year ?? currentYear,
  );
  const selectedDraft = useMemo(
    () => parseMonthValue(draftValue),
    [draftValue],
  );

  const resetDraft = useCallback(() => {
    const parsedValue = parseMonthValue(value);
    setDraftValue(value);
    setDisplayedYear(parsedValue?.year ?? currentYear);
  }, [currentYear, value]);

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

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        closePicker();
      }
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      closePicker(true);
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [closePicker, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const compactViewport = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;

    function synchronizeBackgroundScroll() {
      document.body.style.overflow = compactViewport.matches
        ? "hidden"
        : previousOverflow;
    }

    synchronizeBackgroundScroll();
    compactViewport.addEventListener("change", synchronizeBackgroundScroll);

    return () => {
      compactViewport.removeEventListener(
        "change",
        synchronizeBackgroundScroll,
      );
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function togglePicker() {
    if (isOpen) {
      closePicker();
      return;
    }

    resetDraft();
    setIsOpen(true);
  }

  function applySelection() {
    setIsOpen(false);
    onApply(draftValue);
  }

  function stopPanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

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
        <span className="truncate">{formatMonthValue(value)}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-finhand-subtle transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-finhand-ink/40 backdrop-blur-sm sm:hidden"
            onPointerDown={() => closePicker(true)}
          />
          <div
            aria-label={ariaLabel}
            className="fixed inset-x-4 top-1/2 z-60 flex max-h-[calc(100dvh-2rem)] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-finhand-border bg-white shadow-finhand-modal sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:z-50 sm:mt-2 sm:w-88 sm:translate-y-0"
            id={panelId}
            onPointerDown={stopPanelPointerDown}
            role="dialog"
          >
            <div className="border-b border-finhand-border p-4">
              <button
                aria-pressed={draftValue === ""}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus",
                  draftValue === ""
                    ? "bg-finhand-accent-soft text-finhand-primary"
                    : "text-finhand-neutral hover:bg-finhand-canvas-muted",
                )}
                onClick={() => setDraftValue("")}
                type="button"
              >
                All time
                {draftValue === "" ? (
                  <Check
                    aria-hidden="true"
                    className="size-4 text-finhand-interactive"
                  />
                ) : null}
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <button
                  aria-label="Previous year"
                  className="grid size-9 place-items-center rounded-lg text-finhand-muted transition hover:bg-finhand-canvas-muted hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus"
                  onClick={() => setDisplayedYear((year) => year - 1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <p className="text-sm font-bold text-finhand-ink">
                  {displayedYear}
                </p>
                <button
                  aria-label="Next year"
                  className="grid size-9 place-items-center rounded-lg text-finhand-muted transition hover:bg-finhand-canvas-muted hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={displayedYear >= currentYear}
                  onClick={() => setDisplayedYear((year) => year + 1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {monthNames.map((monthName, monthIndex) => {
                  const monthValue = createMonthValue(
                    displayedYear,
                    monthIndex,
                  );
                  const isSelected =
                    selectedDraft?.year === displayedYear &&
                    selectedDraft.monthIndex === monthIndex;
                  const isFuture =
                    displayedYear === currentYear &&
                    monthIndex > currentMonthIndex;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={cn(
                        "min-h-11 rounded-xl px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus disabled:cursor-not-allowed disabled:text-finhand-subtle",
                        isSelected
                          ? "bg-finhand-primary text-white"
                          : "text-finhand-neutral hover:bg-finhand-canvas-muted hover:text-finhand-ink",
                      )}
                      disabled={isFuture}
                      key={monthName}
                      onClick={() => setDraftValue(monthValue)}
                      type="button"
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-finhand-border bg-finhand-canvas/70 px-4 py-3">
              <p
                className="min-w-0 truncate text-xs font-semibold text-finhand-muted"
                title={formatMonthValue(draftValue)}
              >
                {formatMonthValue(draftValue)}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={() => closePicker(true)}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button onClick={applySelection} size="sm">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

