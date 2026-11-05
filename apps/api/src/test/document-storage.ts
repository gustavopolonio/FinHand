import { vi } from "vitest";

import type { DocumentStorage } from "../storage/document-storage.js";

export function createTestDocumentStorage(): DocumentStorage {
  return {
    close: vi.fn(),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    storeDocument: vi.fn().mockResolvedValue(undefined),
  };
}
