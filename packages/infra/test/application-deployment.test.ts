import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createApplicationDeploymentDocumentContent,
  createApplicationDeploymentScript,
} from "../lib/application-deployment.js";

const options = {
  accountId: "123456789012",
  backupBucketName: "finhand-prod-backups-123456789012",
  caddyConfiguration: "example.com { reverse_proxy web:3000 }\n",
  composeConfiguration: "services:\n  web:\n    image: example/web\n",
  region: "us-east-1",
};
const script = createApplicationDeploymentScript(options);

describe("production application deployment", () => {
  it("produces a syntactically valid root-only, single-run shell script", () => {
    const syntaxCheck = spawnSync("bash", ["-n"], {
      encoding: "utf8",
      input: script,
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(script).toContain('if [[ $(id -u) -ne 0 ]]; then');
    expect(script).toContain('flock --nonblock 9');
    expect(script).toContain(
      'export DOCKER_CONFIG="$temporary_directory/docker"',
    );
    expect(script).toContain('install -d -o root -g root -m 0700 "$DOCKER_CONFIG"');
    expect(script).toContain("Another FinHand deployment is already running.");
    expect(script).not.toContain("set -x");
  });

  it("validates and installs the version-controlled deployment bundle", () => {
    expect(script).toContain("base64 --decode");
    expect(script).toContain("compose.yaml");
    expect(script).toContain("Caddyfile");
    expect(script).toContain("config --quiet");
    expect(script).toMatch(/DEPLOYMENT_REVISION="[0-9a-f]{16}"/u);
    expect(script).toContain(
      'release_directory="$RELEASES_DIRECTORY/${web_release}-${DEPLOYMENT_REVISION}"',
    );
    expect(script).toContain('cmp --silent "$temporary_directory/compose.yaml"');
    expect(script).not.toContain(options.composeConfiguration);
  });

  it("pulls images, verifies a backup, migrates, and then starts services", () => {
    const pullPosition = script.indexOf('"${compose[@]}" --profile deployment pull');
    const backupPosition = script.indexOf("pg_dump --format=custom");
    const verifyPosition = script.indexOf("pg_restore --list");
    const uploadPosition = script.indexOf('aws s3 cp "$backup_path"');
    const migrationPosition = script.indexOf(
      '"${compose[@]}" --profile deployment run --rm migrate',
    );
    const startPosition = script.indexOf(
      '"${current_compose[@]}" up --detach --remove-orphans --wait',
    );

    expect(pullPosition).toBeGreaterThan(-1);
    expect(backupPosition).toBeGreaterThan(pullPosition);
    expect(verifyPosition).toBeGreaterThan(backupPosition);
    expect(uploadPosition).toBeGreaterThan(verifyPosition);
    expect(migrationPosition).toBeGreaterThan(uploadPosition);
    expect(startPosition).toBeGreaterThan(migrationPosition);
    expect(script).toContain('s3://${BACKUP_BUCKET}/${backup_key}');
  });

  it("restores the previous container release when health checks fail", () => {
    expect(script).toContain(
      'previous_release=$(readlink --canonicalize "$CURRENT_RELEASE"',
    );
    expect(script).toContain('rollback_link="$temporary_directory/rollback"');
    expect(script).toContain(
      'mv --force --no-target-directory "$rollback_link" "$CURRENT_RELEASE"',
    );
    expect(script).toContain(
      '"${rollback_compose[@]}" up --detach --no-deps --force-recreate --wait --wait-timeout 180 proxy',
    );
  });

  it("recreates only the proxy so a changed Caddyfile is mounted", () => {
    const proxyStart =
      '"${current_compose[@]}" up --detach --no-deps --force-recreate --wait --wait-timeout 180 proxy';

    expect(script).toContain(proxyStart);
    expect(proxyStart).not.toContain("postgres");
  });

  it("wraps deployment in a bounded Systems Manager command document", () => {
    expect(createApplicationDeploymentDocumentContent(options)).toEqual({
      schemaVersion: "2.2",
      description:
        "Deploy an approved FinHand release with backup, migration, health checks, and container rollback.",
      mainSteps: [
        {
          action: "aws:runShellScript",
          name: "deployApplication",
          inputs: {
            timeoutSeconds: "900",
            runCommand: [script],
          },
        },
      ],
    });
  });
});
