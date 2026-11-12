import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmationHoldMilliseconds,
  HoldToConfirmButton,
  startHoldConfirmation,
} from "./hold-to-confirm-button";

afterEach(() => {
  vi.useRealTimers();
});

describe("hold to confirm", () => {
  it("confirms only after the complete three-second hold", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    const onProgress = vi.fn();

    startHoldConfirmation({ onConfirm, onProgress });
    vi.advanceTimersByTime(confirmationHoldMilliseconds - 1);
    expect(onConfirm).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it("cancels confirmation when the hold ends early", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    const onProgress = vi.fn();
    const cancel = startHoldConfirmation({ onConfirm, onProgress });

    vi.advanceTimersByTime(1_500);
    cancel();
    vi.advanceTimersByTime(confirmationHoldMilliseconds);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(0);
  });

  it("explains the accessible hold interaction", () => {
    const markup = renderToStaticMarkup(
      <HoldToConfirmButton
        onBeforeStart={() => true}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain(
      'aria-label="Hold for 3 seconds to confirm transaction"',
    );
    expect(markup).toContain("Hold to confirm");
  });
});
