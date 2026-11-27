import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UserSettingsMenu } from "./user-settings-menu";

describe("UserSettingsMenu", () => {
  it("renders an accessible settings trigger without signing out directly", () => {
    const markup = renderToStaticMarkup(
      <UserSettingsMenu onSignOut={vi.fn()} placement="above" />,
    );

    expect(markup).toContain('aria-label="Open settings"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("lucide-settings");
    expect(markup).not.toContain("Log out");
  });
});
