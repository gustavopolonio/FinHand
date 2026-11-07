import { describe, expect, it } from "vitest";

import {
  formatDocumentFileSize,
  maximumDocumentBytes,
  validateDocumentFile,
  validateReceiptPhoto,
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

describe("receipt photo validation", () => {
  it.each(["image/jpeg", "image/png"])("accepts %s photos", (type) => {
    expect(
      validateReceiptPhoto({ name: "receipt", size: 1024, type }),
    ).toBeNull();
  });

  it("rejects documents that are not camera images", () => {
    expect(
      validateReceiptPhoto({
        name: "receipt.pdf",
        size: 1024,
        type: "application/pdf",
      }),
    ).toBe("Take a JPEG or PNG photo of the receipt.");
  });

  it("rejects empty and oversized photos", () => {
    const photo = { name: "receipt.jpg", type: "image/jpeg" };

    expect(validateReceiptPhoto({ ...photo, size: 0 })).toBe(
      "The captured photo is empty. Please take it again.",
    );
    expect(
      validateReceiptPhoto({ ...photo, size: maximumDocumentBytes + 1 }),
    ).toBe("The captured photo must be at most 10 MiB.");
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
