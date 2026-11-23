import { describe, expect, it } from "vitest";

import { createUploadObjectKey } from "./upload-object-key.js";

const opaqueKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createUploadObjectKey", () => {
  it.each([
    ["document", "documents"],
    ["audio", "audio"],
  ] as const)("creates an opaque %s storage key", (kind, prefix) => {
    const [firstPrefix, firstStorageId] = createUploadObjectKey(kind).split("/");
    const [secondPrefix, secondStorageId] =
      createUploadObjectKey(kind).split("/");

    expect(firstPrefix).toBe(prefix);
    expect(secondPrefix).toBe(prefix);
    expect(firstStorageId).toMatch(opaqueKeyPattern);
    expect(secondStorageId).toMatch(opaqueKeyPattern);
    expect(firstStorageId).not.toBe(secondStorageId);
  });
});
