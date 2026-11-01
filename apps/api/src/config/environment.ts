import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(currentDirectory, "../../../../.env"),
  quiet: true,
});

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
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
