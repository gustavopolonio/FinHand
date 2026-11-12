"use client";

import { CheckCircle2 } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/class-names";

export const confirmationHoldMilliseconds = 2_400;

interface StartHoldConfirmationOptions {
  durationMilliseconds?: number;
  onConfirm: () => void;
  onProgress: (progress: number) => void;
}

export function startHoldConfirmation({
  durationMilliseconds = confirmationHoldMilliseconds,
  onConfirm,
  onProgress,
}: StartHoldConfirmationOptions): () => void {
  const startedAt = Date.now();
  let completed = false;
  const progressInterval = setInterval(() => {
    onProgress(
      Math.min(1, (Date.now() - startedAt) / durationMilliseconds),
    );
  }, 50);
  const confirmationTimeout = setTimeout(() => {
    completed = true;
    clearInterval(progressInterval);
    onProgress(1);
    onConfirm();
  }, durationMilliseconds);

  return () => {
    clearInterval(progressInterval);
    clearTimeout(confirmationTimeout);
    if (!completed) onProgress(0);
  };
}

interface HoldToConfirmButtonProps {
  className?: string;
  disabled?: boolean;
  isConfirming?: boolean;
  onBeforeStart: () => boolean;
  onConfirm: () => Promise<void> | void;
}

export function HoldToConfirmButton({
  className,
  disabled = false,
  isConfirming = false,
  onBeforeStart,
  onConfirm,
}: HoldToConfirmButtonProps) {
  const cancelHoldRef = useRef<(() => void) | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  function cancelHold() {
    cancelHoldRef.current?.();
    cancelHoldRef.current = null;
    setIsHolding(false);
  }

  function beginHold() {
    if (disabled || isConfirming || isHolding || !onBeforeStart()) return;

    setIsHolding(true);
    cancelHoldRef.current = startHoldConfirmation({
      onProgress: setProgress,
      onConfirm: () => {
        cancelHoldRef.current = null;
        setIsHolding(false);
        void Promise.resolve(onConfirm()).finally(() => setProgress(0));
      },
    });
  }

  useEffect(
    () => () => {
      cancelHoldRef.current?.();
    },
    [],
  );

  function startFromPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.focus();
    beginHold();
  }

  function startFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      !event.repeat &&
      (event.key === " " || event.key === "Enter")
    ) {
      event.preventDefault();
      beginHold();
    }
  }

  function cancelFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      cancelHold();
    }
  }

  return (
    <button
      aria-label="Hold for 3 seconds to confirm transaction"
      className={cn(
        "relative inline-flex min-h-10 touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-xl border border-finhand-primary bg-finhand-primary px-4 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      disabled={disabled || isConfirming}
      onBlur={cancelHold}
      onClick={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={startFromKeyboard}
      onKeyUp={cancelFromKeyboard}
      onPointerCancel={cancelHold}
      onPointerDown={startFromPointer}
      onPointerLeave={cancelHold}
      onPointerUp={cancelHold}
      type="button"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-finhand-primary-strong transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <CheckCircle2 aria-hidden="true" className="relative size-4" />
      <span className="relative">
        {isConfirming
          ? "Creating transaction…"
          : isHolding
            ? "Keep holding…"
            : "Hold to confirm"}
      </span>
    </button>
  );
}
