import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const dockerfile = readFileSync(
  new URL("../../../apps/api/Dockerfile", import.meta.url),
  "utf8",
);
const dockerIgnore = readFileSync(
  new URL("../../../.dockerignore", import.meta.url),
  "utf8",
);

describe("API production container image", () => {
  it("builds the API in a separate stage and installs runtime dependencies only", () => {
    expect(repositoryRoot).toMatch(/fin-hand\/$/);
    expect(dockerfile).toContain(
      "FROM node:${NODE_VERSION}-bookworm-slim@${NODE_IMAGE_DIGEST} AS base",
    );
    expect(dockerfile).toContain(
      "RUN npm ci --workspace @finhand/api --include-workspace-root",
    );
    expect(dockerfile).toContain(
      "RUN npm run build --workspace @finhand/api",
    );
    expect(dockerfile).toContain(
      "npm ci --omit=dev --omit=optional --omit=peer",
    );
    expect(dockerfile).toContain(
      "COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist",
    );
    expect(dockerfile).toContain(
      "COPY --chown=node:node apps/api/drizzle ./apps/api/drizzle",
    );
  });

  it("runs the API as a non-root production process", () => {
    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("API_HOST=0.0.0.0");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    expect(dockerfile).not.toContain("start:worker");
  });

  it("keeps local output, tests, and environment files out of build contexts", () => {
    expect(dockerIgnore).toContain("**/node_modules");
    expect(dockerIgnore).toContain("**/dist");
    expect(dockerIgnore).toContain("**/*.test.ts");
    expect(dockerIgnore).toContain(".env.*");
    expect(dockerfile).not.toMatch(/COPY\s+\.\s+\./);
  });
});

