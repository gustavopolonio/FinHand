import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  TransactionCandidateReviewPanel,
} from "./transaction-candidate-review";

describe("transaction candidate review", () => {
  it("renders a queued state while the first status request loads", () => {
    const markup = renderToStaticMarkup(
      <TransactionCandidateReviewPanel
        accounts={[]}
        categories={[]}
        error={null}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onGetReview={vi.fn()}
        onReject={vi.fn()}
        onUpdate={vi.fn()}
        panelId="candidate-panel"
        tabId="candidate-tab"
        uploadId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(markup).toContain('id="candidate-panel"');
    expect(markup).toContain("Document queued for analysis");
    expect(markup).toContain("appear here automatically");
  });
});
