import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { VoiceRecordingForm } from "./voice-recording-form";

describe("VoiceRecordingForm", () => {
  it("renders recording controls without an audio file picker", () => {
    const markup = renderToStaticMarkup(
      <VoiceRecordingForm
        accounts={[]}
        categories={[]}
        error={null}
        isUploading={false}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onConfirmCandidate={vi.fn()}
        onGetReview={vi.fn()}
        onRejectCandidate={vi.fn()}
        onUpload={vi.fn()}
        onUpdateCandidate={vi.fn()}
        uploadError={null}
      />,
    );

    expect(markup).toContain('id="transaction-voice-panel"');
    expect(markup).toContain('aria-labelledby="transaction-voice-tab"');
    expect(markup).toContain("Describe your transactions");
    expect(markup).toContain("Start recording");
    expect(markup).toContain("Maximum 30 seconds");
    expect(markup).toContain("One recording may include multiple");
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-label="Live microphone input level"');
    expect(markup).not.toContain('type="file"');
  });
});
