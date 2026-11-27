import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  documentPreviewKind,
  DocumentPreviewContent,
  DocumentSourcePreview,
} from "./document-source-preview";

const basePreview = {
  url: "https://signed.example/receipt",
  expiresAt: "2026-11-12T12:05:00.000Z",
};

describe("document source preview", () => {
  it.each([
    ["image/jpeg", "image"],
    ["image/png", "image"],
    ["application/pdf", "pdf"],
    ["audio/webm", "audio"],
    ["text/plain", "unsupported"],
  ] as const)("classifies %s as %s", (contentType, expected) => {
    expect(documentPreviewKind(contentType)).toBe(expected);
  });

  it("renders a private image preview without sending a referrer", () => {
    const markup = renderToStaticMarkup(
      <DocumentPreviewContent
        fileName="receipt.jpg"
        preview={{ ...basePreview, contentType: "image/jpeg" }}
      />,
    );

    expect(markup).toContain("<img");
    expect(markup).toContain(basePreview.url);
    expect(markup).toContain('referrerPolicy="no-referrer"');
  });

  it("renders PDFs in the browser document viewer", () => {
    const markup = renderToStaticMarkup(
      <DocumentPreviewContent
        fileName="receipt.pdf"
        preview={{ ...basePreview, contentType: "application/pdf" }}
      />,
    );

    expect(markup).toContain("<iframe");
    expect(markup).toContain('title="Uploaded document receipt.pdf"');
  });

  it("offers an external fallback for unsupported preview types", () => {
    const markup = renderToStaticMarkup(
      <DocumentPreviewContent
        fileName="receipt.bin"
        preview={{ ...basePreview, contentType: "application/octet-stream" }}
      />,
    );

    expect(markup).toContain("Preview unavailable for this file type");
    expect(markup).toContain("Open document");
  });

  it("renders an audio player for a voice recording", () => {
    const markup = renderToStaticMarkup(
      <DocumentPreviewContent
        fileName="voice-recording.webm"
        preview={{ ...basePreview, contentType: "audio/webm" }}
      />,
    );

    expect(markup).toContain("<audio");
    expect(markup).toContain('controls=""');
    expect(markup).toContain("Original recording voice-recording.webm");
  });

  it("renders a loading state before the preview URL is available", () => {
    const markup = renderToStaticMarkup(
      <DocumentSourcePreview
        className="h-80"
        fileName="receipt.pdf"
        sourceId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(markup).toContain("Original document");
    expect(markup).toContain("Loading original document");
    expect(markup).toContain("h-80");
    expect(markup).not.toContain("receipt.pdf ·");
    expect(markup).not.toContain("private preview expires");
  });

  it("offers an inline hide action when embedded in transaction details", () => {
    const markup = renderToStaticMarkup(
      <DocumentSourcePreview
        onHide={() => undefined}
        sourceId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(markup).toContain("Hide original");
  });

  it("uses recording-specific copy for audio sources", () => {
    const markup = renderToStaticMarkup(
      <DocumentSourcePreview
        fileName="voice-recording.webm"
        sourceId="11111111-1111-4111-8111-111111111111"
        sourceKind="audio"
      />,
    );

    expect(markup).toContain("Original recording");
    expect(markup).toContain("Loading original recording");
  });
});
