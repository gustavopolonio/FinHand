import { describe, expect, it } from "vitest";

import {
  formatDocumentFileSize,
  maximumDocumentBytes,
  validateDocumentFile,
} from "./document-file";

describe("document file validation", () => {
  it.each(["application/pdf", "image/jpeg", "image/png"])(
    "accepts %s within the upload limit",
    (type) => {
      expect(
        validateDocumentFile({ name: "receipt", size: 1024, type }),
      ).toBeNull();
    },
  );

  it("rejects unsupported file types", () => {
    expect(
      validateDocumentFile({
        name: "receipt.txt",
        size: 100,
        type: "text/plain",
      }),
    ).toBe("Choose a PDF, JPEG, or PNG document.");
  });

  it("rejects empty files", () => {
    expect(
      validateDocumentFile({
        name: "receipt.pdf",
        size: 0,
        type: "application/pdf",
      }),
    ).toBe("The selected document is empty.");
  });

  it("accepts the exact size limit and rejects one byte more", () => {
    const file = { name: "receipt.pdf", type: "application/pdf" };

    expect(
      validateDocumentFile({ ...file, size: maximumDocumentBytes }),
    ).toBeNull();
    expect(
      validateDocumentFile({ ...file, size: maximumDocumentBytes + 1 }),
    ).toBe("The selected document must be at most 10 MiB.");
  });
});

describe("formatDocumentFileSize", () => {
  it.each([
    [512, "512 B"],
    [1_536, "1.5 KiB"],
    [1_572_864, "1.5 MiB"],
  ])("formats %i bytes as %s", (bytes, expected) => {
    expect(formatDocumentFileSize(bytes)).toBe(expected);
  });
});
