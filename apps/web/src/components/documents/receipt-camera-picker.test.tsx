import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ReceiptCameraPicker } from "./receipt-camera-picker";

describe("ReceiptCameraPicker", () => {
  it("requests the rear camera and accepts only supported image types", () => {
    const markup = renderToStaticMarkup(
      <ReceiptCameraPicker
        disabled={false}
        file={null}
        onChange={vi.fn()}
        onValidationError={vi.fn()}
      />,
    );

    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="image/jpeg,image/png"');
    expect(markup).toContain('capture="environment"');
    expect(markup).toContain("Open rear camera");
    expect(markup).toContain("JPEG or PNG · Up to 10 MiB");
  });
});
