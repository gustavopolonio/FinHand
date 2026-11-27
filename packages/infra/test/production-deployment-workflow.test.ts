import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const workflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/deploy-production.yml"),
  "utf8",
);
const deploymentScript = readFileSync(
  resolve(repositoryRoot, "deploy/production/deploy-from-github.sh"),
  "utf8",
);

describe("production deployment workflow", () => {
  it("is manual, serialized, CI-gated, and protected by the production environment", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow.split("jobs:")[0]).not.toMatch(/^\s+push:/mu);
    expect(workflow).toContain("group: production-deployment");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("Require successful CI for this commit");
    expect(workflow).toContain("name: production");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("AWS_PRODUCTION_DEPLOY_ROLE_ARN");
    expect(workflow).toContain("actions/github-script@v8");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("aws-actions/configure-aws-credentials@v6");
  });

  it("publishes retry-safe immutable ARM64 images from one full Git SHA", () => {
    expect(workflow).toContain("platforms: linux/arm64");
    expect(workflow).toContain("imageTag=$GITHUB_SHA");
    expect(workflow).toContain("finhand-prod-api-ecr");
    expect(workflow).toContain("finhand-prod-web-ecr");
    expect(workflow).toContain("NEXT_PUBLIC_API_URL=/api");
    expect(workflow).toContain(":${{ github.sha }}");
  });

  it("uses a syntax-valid failure-safe SSM deployment script", () => {
    const syntaxCheck = spawnSync("bash", ["-n"], {
      encoding: "utf8",
      input: deploymentScript,
    });

    expect(syntaxCheck.stderr).toBe("");
    expect(syntaxCheck.status).toBe(0);
    expect(deploymentScript).toContain(
      "/finhand/production/deployment/web-image",
    );
    expect(deploymentScript).toContain(
      "/finhand/production/deployment/api-image",
    );
    expect(deploymentScript).toContain(
      "finhand-prod-render-runtime-config",
    );
    expect(deploymentScript).toContain("finhand-prod-deploy-application");
    expect(deploymentScript).toContain("restore_previous_parameters");
    expect(deploymentScript).toContain("^[0-9a-f]{40}$");
  });
});

