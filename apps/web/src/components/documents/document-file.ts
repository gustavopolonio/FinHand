export const maximumDocumentBytes = 10 * 1024 * 1024;

export const documentFileAccept = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  "application/pdf",
  "image/png",
  "image/jpeg",
].join(",");

const supportedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

interface DocumentFileMetadata {
  name: string;
  size: number;
  type: string;
}

export function validateDocumentFile(
  file: DocumentFileMetadata,
): string | null {
  if (!supportedDocumentMimeTypes.has(file.type.toLowerCase())) {
    return "Choose a PDF, JPEG, or PNG document.";
  }

  if (file.size === 0) {
    return "The selected document is empty.";
  }

  if (file.size > maximumDocumentBytes) {
    return "The selected document must be at most 10 MiB.";
  }

  return null;
}

export function formatDocumentFileSize(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;

  const kibibytes = byteSize / 1024;
  if (kibibytes < 1024) return `${kibibytes.toFixed(1)} KiB`;

  return `${(kibibytes / 1024).toFixed(1)} MiB`;
}
