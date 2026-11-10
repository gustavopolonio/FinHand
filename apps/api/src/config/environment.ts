import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(currentDirectory, "../../../../.env"),
  quiet: true,
});

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function url(name: string): string {
  const value = required(name);

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function port(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return parsedValue;
}

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function enumeration<const Values extends readonly string[]>(
  name: string,
  values: Values,
  fallback: Values[number],
): Values[number] {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  if (!values.includes(value)) {
    throw new Error(`${name} must be one of: ${values.join(", ")}.`);
  }

  return value;
}

const logLevels = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
] as const;

const nodeEnvironments = ["development", "test", "production"] as const;

export const environment = Object.freeze({
  apiHost: process.env.API_HOST?.trim() || "127.0.0.1",
  apiPort: port("API_PORT", 3001),
  databaseUrl: required("DATABASE_URL"),
  logLevel: enumeration("LOG_LEVEL", logLevels, "info"),
  nodeEnvironment: enumeration(
    "NODE_ENV",
    nodeEnvironments,
    "development",
  ),
});

export function getAuthenticationEnvironment() {
  const betterAuthSecret = required("BETTER_AUTH_SECRET");

  if (betterAuthSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  return Object.freeze({
    baseUrl: url("BETTER_AUTH_URL"),
    betterAuthSecret,
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    webUrl: url("WEB_URL"),
  });
}

export function getDocumentStorageEnvironment() {
  return Object.freeze({
    bucket: required("S3_UPLOAD_BUCKET"),
    region: required("AWS_REGION"),
  });
}

export function getDocumentExtractionEnvironment() {
  return Object.freeze({
    apiKey: required("OPENAI_API_KEY"),
    model: required("OPENAI_DOCUMENT_MODEL"),
    pollIntervalMilliseconds: positiveInteger(
      "DOCUMENT_EXTRACTION_POLL_INTERVAL_MS",
      2_000,
    ),
  });
}
