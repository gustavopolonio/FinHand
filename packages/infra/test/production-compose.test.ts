import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composeConfiguration = readFileSync(
  new URL("../../../deploy/production/compose.yaml", import.meta.url),
  "utf8",
);
const caddyConfiguration = readFileSync(
  new URL("../../../deploy/production/Caddyfile", import.meta.url),
  "utf8",
);
const environmentExample = readFileSync(
  new URL("../../../deploy/production/environment.example", import.meta.url),
  "utf8",
);

function serviceConfiguration(serviceName: string): string {
  const serviceStart = composeConfiguration.indexOf(`\n  ${serviceName}:\n`);
  if (serviceStart === -1) {
    throw new Error(`Missing ${serviceName} service.`);
  }

  const remainingConfiguration = composeConfiguration.slice(serviceStart + 1);
  const nextTopLevelEntry = remainingConfiguration
    .slice(1)
    .search(/\n(?: {2}[a-z][a-z0-9_-]*|networks|volumes):\n/u);

  return nextTopLevelEntry === -1
    ? remainingConfiguration
    : remainingConfiguration.slice(0, nextTopLevelEntry + 1);
}

describe("production Compose deployment", () => {
  it("publishes only the Caddy HTTP and HTTPS ports", () => {
    expect(serviceConfiguration("proxy")).toContain(
      'ports:\n      - "80:80"\n      - "443:443"',
    );
    expect(serviceConfiguration("web")).not.toContain("ports:");
    expect(serviceConfiguration("api")).not.toContain("ports:");
    expect(serviceConfiguration("worker")).not.toContain("ports:");
    expect(serviceConfiguration("migrate")).not.toContain("ports:");
    expect(serviceConfiguration("postgres")).not.toContain("ports:");
    expect(caddyConfiguration).toContain("reverse_proxy web:3000");
    expect(caddyConfiguration).toContain("reverse_proxy api:3001");
    expect(caddyConfiguration).toContain("handle /api/*");
  });

  it("trusts exactly the private Caddy hop before deriving client IPs", () => {
    const apiConfiguration = serviceConfiguration("api");

    expect(apiConfiguration).toContain("API_TRUST_PROXY_HOPS: 1");
    expect(apiConfiguration).not.toContain("ports:");
    expect(serviceConfiguration("proxy")).toContain("- frontend");
    expect(apiConfiguration).toContain("- frontend");
  });

  it("serves browser API requests from the web origin", () => {
    const webSiteStart = caddyConfiguration.indexOf("{$WEB_DOMAIN} {");
    const apiSiteStart = caddyConfiguration.indexOf("{$API_DOMAIN} {");
    const webSiteConfiguration = caddyConfiguration.slice(
      webSiteStart,
      apiSiteStart,
    );

    expect(webSiteStart).toBeGreaterThanOrEqual(0);
    expect(apiSiteStart).toBeGreaterThan(webSiteStart);
    expect(webSiteConfiguration).toContain(
      "handle /api/* {\n\t\treverse_proxy api:3001\n\t}",
    );
    expect(webSiteConfiguration).toContain(
      "handle {\n\t\treverse_proxy web:3000\n\t}",
    );
  });

  it("runs migrations as an explicit one-off database-only service", () => {
    const migrationConfiguration = serviceConfiguration("migrate");

    expect(migrationConfiguration).toContain(
      "image: ${FINHAND_API_IMAGE:",
    );
    expect(migrationConfiguration).toContain("- dist/migrate.js");
    expect(migrationConfiguration).toContain("- deployment");
    expect(migrationConfiguration).toContain("/migration.env");
    expect(migrationConfiguration).toContain("- backend");
    expect(migrationConfiguration).not.toContain("frontend");
    expect(migrationConfiguration).not.toContain("restart:");
  });

  it("runs the API and worker from the same immutable application image", () => {
    expect(serviceConfiguration("api")).toContain(
      "image: ${FINHAND_API_IMAGE:",
    );
    expect(serviceConfiguration("worker")).toContain(
      "image: ${FINHAND_API_IMAGE:",
    );
    expect(serviceConfiguration("worker")).toContain(
      "- dist/worker.js",
    );
    expect(environmentExample).toContain(
      "finhand-prod-api-ecr:<git-commit-sha>",
    );
    expect(environmentExample).toContain(
      "finhand-prod-web-ecr:<git-commit-sha>",
    );
  });

  it("keeps PostgreSQL private on the dedicated data mount", () => {
    const postgresConfiguration = serviceConfiguration("postgres");

    expect(postgresConfiguration).toContain(
      "image: pgvector/pgvector:0.8.7-pg17-bookworm@sha256:",
    );
    expect(postgresConfiguration).toContain(
      "${POSTGRES_DATA_DIR:-/srv/finhand/postgres}:/var/lib/postgresql/data",
    );
    expect(postgresConfiguration).toContain("/postgres.env");
    expect(postgresConfiguration).toContain(
      "PGDATA: /var/lib/postgresql/data/pgdata",
    );
    expect(postgresConfiguration).not.toContain("frontend");
    expect(postgresConfiguration).not.toContain("ports:");
  });

  it("adds restart, health, resource, and log safeguards to every service", () => {
    expect(composeConfiguration.match(/restart: unless-stopped/gu)).toHaveLength(
      5,
    );
    expect(composeConfiguration.match(/healthcheck:/gu)).toHaveLength(5);
    expect(composeConfiguration.match(/driver: awslogs/gu)).toHaveLength(6);
    expect(composeConfiguration.match(/mem_limit:/gu)).toHaveLength(6);
    expect(composeConfiguration.match(/cpus:/gu)).toHaveLength(6);
  });

  it("ships each service log to its retained CloudWatch log group", () => {
    expect(composeConfiguration).toContain(
      "x-cloudwatch-log-options: &cloudwatch-log-options",
    );
    expect(composeConfiguration).toContain("awslogs-region: us-east-1");
    expect(composeConfiguration).toContain('awslogs-create-group: "false"');
    expect(composeConfiguration).toContain("mode: non-blocking");
    expect(composeConfiguration).toContain("max-buffer-size: 4m");
    expect(composeConfiguration).toContain('tag: "{{.Name}}-{{.ID}}"');
    expect(composeConfiguration).not.toContain("driver: json-file");
    expect(composeConfiguration).not.toContain("awslogs-stream-prefix");

    for (const serviceName of [
      "api",
      "migrate",
      "postgres",
      "proxy",
      "web",
      "worker",
    ]) {
      const service = serviceConfiguration(serviceName);

      expect(service).toContain("driver: awslogs");
      expect(service).toContain("<<: *cloudwatch-log-options");
      expect(service).toContain(
        `awslogs-group: /finhand/production/${serviceName}`,
      );
    }
  });

  it("keeps application secrets outside version-controlled deployment files", () => {
    expect(composeConfiguration).toContain("/api.env");
    expect(composeConfiguration).toContain("/worker.env");
    expect(composeConfiguration).toContain("/migration.env");
    expect(composeConfiguration).toContain("/postgres.env");
    expect(composeConfiguration).not.toMatch(/OPENAI_API_KEY=/u);
    expect(composeConfiguration).not.toMatch(/DATABASE_URL=/u);
    expect(composeConfiguration).not.toMatch(/BETTER_AUTH_SECRET=/u);
    expect(environmentExample).not.toMatch(/PASSWORD=/u);
    expect(environmentExample).not.toMatch(/SECRET=/u);
    expect(serviceConfiguration("proxy")).toContain(
      "image: caddy:2.10.2-alpine@sha256:",
    );
    expect(composeConfiguration).not.toContain(":latest");
  });
});
