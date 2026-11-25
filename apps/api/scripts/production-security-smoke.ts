import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface ProductionSecuritySmokeOptions {
  apiUrl: URL;
  webUrl: URL;
}

type FetchRequest = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function getArgument(args: string[], name: string): string | undefined {
  const assignment = args.find((argument) =>
    argument.startsWith(`${name}=`),
  );
  if (assignment) return assignment.slice(name.length + 1);

  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function productionOrigin(value: string | undefined, name: string): URL {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }

  return url;
}

export function parseProductionSecuritySmokeOptions(
  args: string[],
): ProductionSecuritySmokeOptions {
  return {
    apiUrl: productionOrigin(getArgument(args, "--api-url"), "--api-url"),
    webUrl: productionOrigin(getArgument(args, "--web-url"), "--web-url"),
  };
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertStatus(
  response: Response,
  expectedStatus: number,
  label: string,
): void {
  assertCondition(
    response.status === expectedStatus,
    `${label} returned HTTP ${response.status}; expected ${expectedStatus}.`,
  );
}

function assertSecurityHeaders(response: Response, label: string): void {
  assertCondition(
    response.headers.get("strict-transport-security") ===
      "max-age=31536000",
    `${label} is missing the expected HSTS policy.`,
  );
  assertCondition(
    response.headers.get("content-security-policy") ===
      "frame-ancestors 'none'",
    `${label} is missing the expected frame-ancestors policy.`,
  );
  assertCondition(
    response.headers.get("x-frame-options") === "DENY",
    `${label} is missing X-Frame-Options: DENY.`,
  );
  assertCondition(
    response.headers.get("x-content-type-options") === "nosniff",
    `${label} is missing X-Content-Type-Options: nosniff.`,
  );
  assertCondition(
    response.headers.get("referrer-policy") ===
      "strict-origin-when-cross-origin",
    `${label} is missing the expected referrer policy.`,
  );
  assertCondition(
    response.headers.get("permissions-policy") ===
      "camera=(self), microphone=(self), geolocation=()",
    `${label} is missing the expected permissions policy.`,
  );
  assertCondition(
    response.headers.get("server") === null,
    `${label} exposes a Server response header.`,
  );
  assertCondition(
    response.headers.get("x-powered-by") === null,
    `${label} exposes an X-Powered-By response header.`,
  );
}

async function readJson(response: Response, label: string) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} did not return JSON.`);
  }
}

async function smokeRequest(
  request: FetchRequest,
  url: URL,
  init: RequestInit = {},
): Promise<Response> {
  return request(url, {
    ...init,
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
}

export async function runProductionSecuritySmoke(
  { apiUrl, webUrl }: ProductionSecuritySmokeOptions,
  request: FetchRequest = fetch,
  report: (message: string) => void = console.log,
): Promise<void> {
  const webResponse = await smokeRequest(request, new URL("/", webUrl));
  assertStatus(webResponse, 200, "Web root");
  assertSecurityHeaders(webResponse, "Web root");
  report("PASS web HTTPS security headers");

  const healthResponse = await smokeRequest(
    request,
    new URL("/health", apiUrl),
  );
  assertStatus(healthResponse, 200, "API health");
  assertSecurityHeaders(healthResponse, "API health");
  assertCondition(
    healthResponse.headers.get("x-request-id") !== null,
    "API health is missing a trusted request ID.",
  );
  const health = await readJson(healthResponse, "API health");
  assertCondition(health.status === "ok", "API health did not report ok.");
  report("PASS API health and HTTPS security headers");

  const trustedCorsResponse = await smokeRequest(
    request,
    new URL("/health", apiUrl),
    { headers: { origin: webUrl.origin } },
  );
  assertCondition(
    trustedCorsResponse.headers.get("access-control-allow-origin") ===
      webUrl.origin,
    "API did not allow the configured web origin.",
  );
  assertCondition(
    trustedCorsResponse.headers.get("access-control-allow-credentials") ===
      "true",
    "API did not expose credentialed CORS for the configured web origin.",
  );

  const untrustedOrigin = "https://security-smoke.invalid";
  const untrustedCorsResponse = await smokeRequest(
    request,
    new URL("/health", apiUrl),
    { headers: { origin: untrustedOrigin } },
  );
  assertCondition(
    untrustedCorsResponse.headers.get("access-control-allow-origin") !==
      untrustedOrigin,
    "API reflected an untrusted CORS origin.",
  );
  report("PASS exact-origin CORS policy");

  const originGuardResponse = await smokeRequest(
    request,
    new URL("/api/accounts", apiUrl),
    {
      body: JSON.stringify({
        name: "Production security smoke",
        type: "cash",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "finhand_security_smoke=invalid",
        origin: untrustedOrigin,
      },
      method: "POST",
    },
  );
  assertStatus(originGuardResponse, 403, "Origin guard");
  const originGuard = await readJson(originGuardResponse, "Origin guard");
  assertCondition(
    originGuard.code === "ORIGIN_NOT_ALLOWED",
    "Origin guard returned an unexpected error code.",
  );
  report("PASS unsafe cookie-authenticated origin rejection");

  const oversizedUrl = new URL("/api/accounts", apiUrl);
  oversizedUrl.searchParams.set("value", "x".repeat(4_096));
  const urlLimitResponse = await smokeRequest(request, oversizedUrl);
  assertStatus(urlLimitResponse, 414, "Request URL limit");
  const urlLimit = await readJson(urlLimitResponse, "Request URL limit");
  assertCondition(
    urlLimit.code === "REQUEST_URI_TOO_LONG",
    "Request URL limit returned an unexpected error code.",
  );
  report("PASS request URL limit");

  const bodyLimitResponse = await smokeRequest(
    request,
    new URL("/api/accounts", apiUrl),
    {
      body: JSON.stringify({ value: "x".repeat(64 * 1_024) }),
      headers: {
        "content-type": "application/json",
        origin: webUrl.origin,
      },
      method: "POST",
    },
  );
  assertStatus(bodyLimitResponse, 413, "Request body limit");
  const bodyLimit = await readJson(bodyLimitResponse, "Request body limit");
  assertCondition(
    bodyLimit.code === "REQUEST_BODY_TOO_LARGE",
    "Request body limit returned an unexpected error code.",
  );
  report("PASS buffered request-body limit");
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(
    entryPoint &&
      import.meta.url === pathToFileURL(resolve(entryPoint)).href,
  );
}

if (isDirectExecution()) {
  try {
    const options = parseProductionSecuritySmokeOptions(
      process.argv.slice(2),
    );
    await runProductionSecuritySmoke(options);
    console.log("Production security smoke checks passed.");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Security smoke check failed.",
    );
    process.exitCode = 1;
  }
}
