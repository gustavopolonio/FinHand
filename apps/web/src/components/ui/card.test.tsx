import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Card } from "./card";

describe("surface variants", () => {
  it("uses a readable foreground on a primary card", () => {
    const markup = renderToStaticMarkup(
      <Card variant="primary">Balance</Card>,
    );

    expect(markup).toContain("bg-finhand-primary");
    expect(markup).toContain("text-white");
    expect(markup).not.toContain("bg-white\"");
  });

  it("uses an inverse badge on a primary surface", () => {
    const markup = renderToStaticMarkup(
      <Badge variant="inverse">Active</Badge>,
    );

    expect(markup).toContain("bg-white/12");
    expect(markup).toContain("text-white");
    expect(markup).not.toContain("bg-finhand-accent-soft");
  });
});
