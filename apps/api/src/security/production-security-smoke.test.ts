import { describe, expect, it, vi } from "vitest";

import {
  parseProductionSecuritySmokeOptions,
  runProductionSecuritySmoke,
} from "../../scripts/production-security-smoke.js";

const securityHeaders = {
  "content-security-policy": "frame-ancestors 'none'",
  "permissions-policy":
    "camera=(self), microphone=(self), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("production security smoke script", () => {
  it("requires clean HTTPS production origins", () => {
    expect(
      parseProductionSecuritySmokeOptions([
        "--web-url=https://finhand.example",
        "--api-url",
        "https://api.finhand.example",
      ]),
    ).toEqual({
      webUrl: new URL("https://finhand.example"),
      apiUrl: new URL("https://api.finhand.example"),
    });

    expect(() =>
      parseProductionSecuritySmokeOptions([
        "--web-url=http://finhand.example",
        "--api-url=https://api.finhand.example",
      ]),
    ).toThrow("--web-url must use HTTPS.");
    expect(() =>
      parseProductionSecuritySmokeOptions([
        "--web-url=https://finhand.example/private",
        "--api-url=https://api.finhand.example",
      ]),
    ).toThrow("--web-url must be an HTTPS origin");
  });

  it("checks headers, CORS, origin validation, and request limits without mutations", async () => {
    const responses = [
      new Response("web", { status: 200, headers: securityHeaders }),
      jsonResponse(
        { status: "ok" },
        200,
        { ...securityHeaders, "x-request-id": "request-id" },
      ),
      jsonResponse(
        { status: "ok" },
        200,
        {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": "https://finhand.example",
        },
      ),
      jsonResponse({ status: "ok" }),
      jsonResponse({ code: "ORIGIN_NOT_ALLOWED" }, 403),
      jsonResponse({ code: "REQUEST_URI_TOO_LONG" }, 414),
      jsonResponse({ code: "REQUEST_BODY_TOO_LARGE" }, 413),
    ];
    const request = vi.fn(
      async (_input: string | URL, _init?: RequestInit) =>
        responses.shift()!,
    );
    const report = vi.fn();

    await expect(
      runProductionSecuritySmoke(
        {
          webUrl: new URL("https://finhand.example"),
          apiUrl: new URL("https://api.finhand.example"),
        },
        request,
        report,
      ),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(7);
    expect(report).toHaveBeenCalledTimes(6);
    const mutatingCalls = request.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(mutatingCalls).toHaveLength(2);
    expect(
      mutatingCalls.every(([input]) =>
        String(input).endsWith("/api/accounts"),
      ),
    ).toBe(true);
    expect(mutatingCalls[0]?.[1]?.body).toBe(
      JSON.stringify({
        name: "Production security smoke",
        type: "cash",
      }),
    );
  });
});
