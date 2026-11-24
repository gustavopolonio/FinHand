import { RequestUriTooLongError } from "../errors/application-errors.js";

export const requestLimits = Object.freeze({
  bodyBytes: 64 * 1024,
  connectionTimeoutMilliseconds: 60_000,
  maximumParameterCharacters: 100,
  maximumUrlCharacters: 4_096,
  requestTimeoutMilliseconds: 120_000,
});

export function enforceRequestUrlLimit(requestUrl: string): void {
  if (requestUrl.length > requestLimits.maximumUrlCharacters) {
    throw new RequestUriTooLongError();
  }
}
