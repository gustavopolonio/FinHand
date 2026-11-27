"use client";

import { LogOut, Settings } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/class-names";

interface UserSettingsMenuProps {
  onSignOut: () => void;
  placement?: "above" | "below";
  triggerClassName?: string;
}

interface MenuPosition {
  bottom?: number;
  left: number;
  top?: number;
}

export function UserSettingsMenu({
  onSignOut,
  placement = "below",
  triggerClassName,
}: UserSettingsMenuProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const menuWidth = Math.min(208, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );

    setPosition({
      ...(placement === "above"
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
      left,
    });
  }, [placement]);

  const openMenu = useCallback(() => {
    updatePosition();
    setIsOpen(true);
    window.requestAnimationFrame(() => firstItemRef.current?.focus());
  }, [updatePosition]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setPosition(null);

    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [closeMenu, isOpen, updatePosition]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown") return;

    event.preventDefault();
    openMenu();
  }

  return (
    <div className="shrink-0">
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open settings"
        className={cn(
          "grid place-items-center rounded-lg text-finhand-muted transition hover:bg-white hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus",
          isOpen && "bg-white text-finhand-primary-strong shadow-finhand-card",
          triggerClassName,
        )}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        title="Settings"
        type="button"
      >
        <Settings
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            isOpen && "rotate-45",
          )}
        />
      </button>

      {isOpen && position && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label="User settings"
              className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-finhand-border bg-white p-1.5 shadow-finhand-modal"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={position as CSSProperties}
            >
              <button
                className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-finhand-expense transition hover:bg-finhand-expense-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-finhand-expense"
                onClick={() => {
                  closeMenu();
                  onSignOut();
                }}
                ref={firstItemRef}
                role="menuitem"
                type="button"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Log out
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
