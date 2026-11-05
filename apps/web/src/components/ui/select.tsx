"use client";

import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/class-names";

export interface SelectOption {
  badge?: string;
  description?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  value: string;
}

type SelectVariant = "default" | "soft" | "compact";

interface SelectProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  menuLabel?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
  variant?: SelectVariant;
}

interface MenuPosition {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
}

const variantClasses: Record<SelectVariant, string> = {
  default:
    "min-h-11 border border-finhand-border bg-finhand-canvas-muted px-3",
  soft: "min-h-12 border border-finhand-border-strong bg-white px-3.5",
  compact: "min-h-10 border border-finhand-border bg-white px-3",
};

export function findNextEnabledOptionIndex(
  options: SelectOption[],
  startIndex: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (startIndex + direction * offset + options.length) % options.length;

    if (!options[index]?.disabled) return index;
  }

  return -1;
}

export function Select({
  ariaLabel,
  className,
  disabled = false,
  menuLabel,
  onValueChange,
  options,
  placeholder = "Select an option",
  value,
  variant = "default",
}: SelectProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  function updatePosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = Math.max(
      140,
      Math.min(320, (openAbove ? spaceAbove : spaceBelow) - gap),
    );
    const width = Math.min(
      Math.max(rect.width, 220),
      window.innerWidth - viewportPadding * 2,
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );

    setPosition({
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
      left,
      maxHeight: availableSpace,
      width,
    });
  }

  function openMenu(preferredIndex = selectedIndex) {
    if (disabled) return;

    const firstEnabled =
      preferredIndex >= 0 && !options[preferredIndex]?.disabled
        ? preferredIndex
        : findNextEnabledOptionIndex(options, -1, 1);

    setHighlightedIndex(firstEnabled);
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
    setPosition(null);
  }

  function chooseOption(option: SelectOption) {
    if (option.disabled) return;

    onValueChange(option.value);
    closeMenu();
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    }

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) {
        clearTimeout(typeaheadTimerRef.current);
      }
    },
    [],
  );

  function handleTypeahead(key: string) {
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
    }

    typeaheadRef.current += key.toLocaleLowerCase();
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadRef.current = "";
    }, 500);

    const matchIndex = options.findIndex(
      (option) =>
        !option.disabled &&
        option.label
          .toLocaleLowerCase()
          .startsWith(typeaheadRef.current),
    );

    if (matchIndex >= 0) {
      setHighlightedIndex(matchIndex);
      if (!isOpen) setIsOpen(true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;

      if (!isOpen) {
        openMenu();
      } else {
        setHighlightedIndex((current) =>
          findNextEnabledOptionIndex(options, current, direction),
        );
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (!isOpen) {
        openMenu();
      } else if (highlightedIndex >= 0) {
        const option = options[highlightedIndex];
        if (option) chooseOption(option);
      }
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const start = event.key === "Home" ? -1 : 0;
      const direction = event.key === "Home" ? 1 : -1;
      setHighlightedIndex(
        findNextEnabledOptionIndex(options, start, direction),
      );
      if (!isOpen) setIsOpen(true);
      return;
    }

    if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      handleTypeahead(event.key);
    }
  }

  const SelectedIcon = selectedOption?.icon;
  const menuStyle: CSSProperties | undefined = position
    ? {
        bottom: position.bottom,
        left: position.left,
        maxHeight: position.maxHeight,
        top: position.top,
        width: position.width,
      }
    : undefined;

  return (
    <div className={cn("relative", className)}>
      <button
        aria-activedescendant={
          isOpen && highlightedIndex >= 0
            ? `${listboxId}-option-${highlightedIndex}`
            : undefined
        }
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          isOpen &&
            "border-2 border-finhand-focus bg-finhand-accent-soft shadow-finhand-card",
        )}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {SelectedIcon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-finhand-accent-border bg-white text-finhand-interactive">
              <SelectedIcon aria-hidden="true" className="size-4" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate font-semibold",
                selectedOption ? "text-finhand-ink" : "text-finhand-subtle",
              )}
            >
              {selectedOption?.label ?? placeholder}
            </span>
            {selectedOption?.description ? (
              <span className="mt-0.5 block truncate text-[11px] text-finhand-muted">
                {selectedOption.description}
              </span>
            ) : null}
          </span>
          {selectedOption?.badge ? (
            <span className="shrink-0 rounded bg-finhand-accent px-2 py-0.5 text-[10px] font-semibold text-finhand-interactive">
              {selectedOption.badge}
            </span>
          ) : null}
        </span>

        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-finhand-accent text-finhand-interactive">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </span>
      </button>

      {isOpen && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-finhand-border bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
              ref={menuRef}
              style={menuStyle}
            >
              {menuLabel ? (
                <div className="shrink-0 bg-finhand-canvas-muted px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-finhand-subtle">
                  {menuLabel}
                </div>
              ) : null}
              <div className="min-h-0 overflow-y-auto" id={listboxId} role="listbox">
                {options.map((option, index) => {
                  const Icon = option.icon;
                  const isSelected = index === selectedIndex;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      aria-disabled={option.disabled || undefined}
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 border-t border-l-4 border-t-finhand-divider px-3.5 py-2.5 text-left first:border-t-0",
                        isSelected &&
                          "border-l-finhand-focus bg-finhand-accent-soft",
                        !isSelected && "border-l-transparent",
                        isHighlighted && !isSelected &&
                          "border-l-finhand-accent-border bg-finhand-canvas-muted",
                        option.disabled
                          ? "cursor-not-allowed bg-finhand-canvas-muted opacity-55"
                          : "cursor-pointer hover:bg-finhand-canvas-muted",
                      )}
                      disabled={option.disabled}
                      id={`${listboxId}-option-${index}`}
                      key={option.value}
                      onClick={() => chooseOption(option)}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {Icon ? (
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-finhand-accent-soft text-finhand-interactive">
                            <Icon aria-hidden="true" className="size-4" />
                          </span>
                        ) : null}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-xs font-bold text-finhand-ink">
                              {option.label}
                            </span>
                            {option.badge ? (
                              <span className="shrink-0 rounded bg-finhand-accent px-1.5 py-0.5 text-[9px] font-semibold text-finhand-interactive">
                                {option.badge}
                              </span>
                            ) : null}
                          </span>
                          {option.description ? (
                            <span className="mt-0.5 block truncate text-[10px] text-finhand-muted">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-finhand-interactive"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
