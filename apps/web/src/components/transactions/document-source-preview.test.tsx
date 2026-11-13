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

  it("renders a loading state before the preview URL is available", () => {
    const markup = renderToStaticMarkup(
      <DocumentSourcePreview
        fileName="receipt.pdf"
        sourceId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(markup).toContain("Original document");
    expect(markup).toContain("Loading original document");
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
});
