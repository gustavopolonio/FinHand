import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({ config: vi.fn() }));

const validEnvironment = {
  DATABASE_URL: "postgresql://user:password@localhost:5433/finhand",
  BETTER_AUTH_SECRET: "a-secure-test-secret-with-32-characters",
  BETTER_AUTH_URL: "http://localhost:3001/",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  AWS_REGION: "sa-east-1",
  S3_UPLOAD_BUCKET: "finhand-test-uploads",
  OPENAI_API_KEY: "openai-test-api-key",
  OPENAI_DOCUMENT_MODEL: "test-vision-model",
  WEB_URL: "http://localhost:3000/",
};

function stubValidEnvironment() {
  for (const [name, value] of Object.entries(validEnvironment)) {
    vi.stubEnv(name, value);
  }

  vi.stubEnv("API_HOST", "");
  vi.stubEnv("API_PORT", "");
  vi.stubEnv("LOG_LEVEL", "");
  vi.stubEnv("NODE_ENV", "");
  vi.stubEnv("DOCUMENT_EXTRACTION_POLL_INTERVAL_MS", "");
}

async function importEnvironment() {
  vi.resetModules();
  return import("./environment.js");
}

beforeEach(() => {
  stubValidEnvironment();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("environment configuration", () => {
  it("applies server defaults and normalizes authentication URLs", async () => {
    const { environment, getAuthenticationEnvironment } =
      await importEnvironment();

    expect(environment).toEqual({
      apiHost: "127.0.0.1",
      apiPort: 3001,
      databaseUrl: validEnvironment.DATABASE_URL,
      logLevel: "info",
      nodeEnvironment: "development",
    });
    expect(getAuthenticationEnvironment()).toEqual({
      baseUrl: "http://localhost:3001",
      betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
      googleClientId: "google-client-id",
      googleClientSecret: "google-client-secret",
      webUrl: "http://localhost:3000",
    });
  });

  it("accepts explicit server settings", async () => {
    vi.stubEnv("API_HOST", " 0.0.0.0 ");
    vi.stubEnv("API_PORT", "4000");
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("NODE_ENV", "production");

    const { environment } = await importEnvironment();

    expect(environment).toMatchObject({
      apiHost: "0.0.0.0",
      apiPort: 4000,
      logLevel: "debug",
      nodeEnvironment: "production",
    });
  });

  it("returns the private document storage configuration", async () => {
    const { getDocumentStorageEnvironment } = await importEnvironment();

    expect(getDocumentStorageEnvironment()).toEqual({
      bucket: "finhand-test-uploads",
      region: "sa-east-1",
    });
  });

  it("returns the AI document extraction configuration", async () => {
    const { getDocumentExtractionEnvironment } = await importEnvironment();

    expect(getDocumentExtractionEnvironment()).toEqual({
      apiKey: "openai-test-api-key",
      model: "test-vision-model",
      pollIntervalMilliseconds: 2_000,
    });
  });

  it("accepts an explicit document extraction poll interval", async () => {
    vi.stubEnv("DOCUMENT_EXTRACTION_POLL_INTERVAL_MS", "5000");
    const { getDocumentExtractionEnvironment } = await importEnvironment();

    expect(
      getDocumentExtractionEnvironment().pollIntervalMilliseconds,
    ).toBe(5_000);
  });

  it.each([
    ["DATABASE_URL", "", "DATABASE_URL is required."],
    [
      "API_PORT",
      "0",
      "API_PORT must be an integer between 1 and 65535.",
    ],
    [
      "API_PORT",
      "65536",
      "API_PORT must be an integer between 1 and 65535.",
    ],
    [
      "API_PORT",
      "1.5",
      "API_PORT must be an integer between 1 and 65535.",
    ],
    [
      "LOG_LEVEL",
      "verbose",
      "LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal, silent.",
    ],
    [
      "NODE_ENV",
      "staging",
      "NODE_ENV must be one of: development, test, production.",
    ],
  ])("rejects invalid %s configuration", async (name, value, message) => {
    vi.stubEnv(name, value);

    await expect(importEnvironment()).rejects.toThrow(message);
  });

  it.each([
    ["BETTER_AUTH_SECRET", "", "BETTER_AUTH_SECRET is required."],
    [
      "BETTER_AUTH_SECRET",
      "too-short",
      "BETTER_AUTH_SECRET must contain at least 32 characters.",
    ],
    [
      "BETTER_AUTH_URL",
      "not-a-url",
      "BETTER_AUTH_URL must be a valid absolute URL.",
    ],
    ["GOOGLE_CLIENT_ID", "", "GOOGLE_CLIENT_ID is required."],
    ["GOOGLE_CLIENT_SECRET", "", "GOOGLE_CLIENT_SECRET is required."],
    ["WEB_URL", "relative", "WEB_URL must be a valid absolute URL."],
  ])("rejects invalid authentication setting %s", async (name, value, message) => {
    const { getAuthenticationEnvironment } = await importEnvironment();
    vi.stubEnv(name, value);

    expect(() => getAuthenticationEnvironment()).toThrow(message);
  });

  it.each([
    ["AWS_REGION", "", "AWS_REGION is required."],
    ["S3_UPLOAD_BUCKET", "", "S3_UPLOAD_BUCKET is required."],
  ])("rejects missing storage setting %s", async (name, value, message) => {
    const { getDocumentStorageEnvironment } = await importEnvironment();
    vi.stubEnv(name, value);

    expect(() => getDocumentStorageEnvironment()).toThrow(message);
  });

  it.each([
    ["OPENAI_API_KEY", "", "OPENAI_API_KEY is required."],
    [
      "OPENAI_DOCUMENT_MODEL",
      "",
      "OPENAI_DOCUMENT_MODEL is required.",
    ],
    [
      "DOCUMENT_EXTRACTION_POLL_INTERVAL_MS",
      "0",
      "DOCUMENT_EXTRACTION_POLL_INTERVAL_MS must be a positive integer.",
    ],
    [
      "DOCUMENT_EXTRACTION_POLL_INTERVAL_MS",
      "1.5",
      "DOCUMENT_EXTRACTION_POLL_INTERVAL_MS must be a positive integer.",
    ],
  ])(
    "rejects invalid document extraction setting %s",
    async (name, value, message) => {
      const { getDocumentExtractionEnvironment } = await importEnvironment();
      vi.stubEnv(name, value);

      expect(() => getDocumentExtractionEnvironment()).toThrow(message);
    },
  );
});
