import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("uses the shared field height, focus treatment, and long-text truncation", () => {
    const markup = renderToStaticMarkup(
      <Input aria-label="Description" value="A very long description" readOnly />,
    );

    expect(markup).toContain("h-12");
    expect(markup).toContain("text-ellipsis");
    expect(markup).toContain("focus:border-finhand-focus");
  });
});
