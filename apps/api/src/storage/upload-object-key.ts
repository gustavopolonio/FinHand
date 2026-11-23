import { randomUUID } from "node:crypto";

const uploadObjectKeyPrefixes = {
  audio: "audio",
  document: "documents",
} as const;

export type UploadObjectKind = keyof typeof uploadObjectKeyPrefixes;

export function createUploadObjectKey(kind: UploadObjectKind): string {
  return `${uploadObjectKeyPrefixes[kind]}/${randomUUID()}`;
}
