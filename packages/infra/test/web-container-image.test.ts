import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(
  new URL("../../../apps/web/Dockerfile", import.meta.url),
  "utf8",
);
const nextConfiguration = readFileSync(
  new URL("../../../apps/web/next.config.ts", import.meta.url),
  "utf8",
);

describe("web production container image", () => {
  it("builds a standalone Next.js server with an explicit public API URL", () => {
    expect(nextConfiguration).toContain('output: "standalone"');
    expect(nextConfiguration).toContain("outputFileTracingRoot:");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_API_URL");
    expect(dockerfile).toContain('RUN test -n "$NEXT_PUBLIC_API_URL"');
    expect(dockerfile).toContain(
      "RUN npm run build --workspace @finhand/web",
    );
    expect(dockerfile).toContain(
      "/app/apps/web/.next/standalone ./",
    );
    expect(dockerfile).toContain(
      "/app/apps/web/.next/static ./apps/web/.next/static",
    );
  });

  it("uses the pinned base image and a non-root runtime", () => {
    expect(dockerfile).toContain(
      "FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST} AS base",
    );
    expect(dockerfile).toContain("NEXT_TELEMETRY_DISABLED=1");
    expect(dockerfile).toContain("NODE_ENV=production");
    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });

  it("does not copy local environment files or the complete repository", () => {
    expect(dockerfile).not.toMatch(/COPY\s+\.\s+\./);
    expect(dockerfile).not.toContain(".env");
  });
});

