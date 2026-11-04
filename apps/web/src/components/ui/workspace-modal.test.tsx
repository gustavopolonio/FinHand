import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceModal } from "./workspace-modal";

describe("WorkspaceModal", () => {
  it("renders a centered accessible modal surface", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceModal
        description="Record a new item."
        isBusy={false}
        onClose={vi.fn()}
        title="Add Item"
      >
        <div>Form content</div>
      </WorkspaceModal>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("items-center");
    expect(markup).toContain("justify-center");
    expect(markup).toContain("Add Item");
    expect(markup).toContain("Record a new item.");
    expect(markup).toContain("Form content");
  });
});
