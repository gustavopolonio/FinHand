import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createRuntimeConfigurationDocumentContent,
  createRuntimeConfigurationScript,
  runtimeParameterRoot,
} from "../lib/runtime-configuration.js";

const scriptOptions = {
  accountId: "123456789012",
  region: "us-east-1",
  uploadsBucketName: "finhand-prod-uploads-123456789012",
};
const runtimeConfigurationScript =
  createRuntimeConfigurationScript(scriptOptions);

describe("production runtime configuration", () => {
  it("produces a syntactically valid root-only shell script", () => {
    const syntaxCheck = spawnSync("bash", ["-n"], {
      encoding: "utf8",
      input: runtimeConfigurationScript,
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(runtimeConfigurationScript).toContain(
      'if [[ $(id -u) -ne 0 ]]; then',
    );
    expect(runtimeConfigurationScript).toContain("umask 077");
    expect(runtimeConfigurationScript).not.toContain("set -x");
  });

  it("retrieves only the approved production parameter hierarchy", () => {
    expect(runtimeParameterRoot).toBe("/finhand/production");
    expect(runtimeConfigurationScript).toContain(
      'aws ssm get-parameters-by-path --path "$PARAMETER_ROOT" --recursive --with-decryption',
    );

    for (const parameterName of [
      "deployment/web-image",
      "deployment/api-image",
      "deployment/web-domain",
      "deployment/api-domain",
      "deployment/acme-email",
      "database/user",
      "database/password",
      "database/name",
      "application/log-level",
      "application/better-auth-secret",
      "application/google-client-id",
      "application/google-client-secret",
      "application/openai-api-key",
      "application/openai-document-model",
    ]) {
      expect(runtimeConfigurationScript).toContain(
        `get_parameter "${parameterName}"`,
      );
    }

    expect(runtimeConfigurationScript).toContain(
      'get_parameter "database/password" "SecureString"',
    );
    expect(runtimeConfigurationScript).toContain(
      'get_parameter "application/google-client-id" "String"',
    );
  });

  it("validates immutable images, domains, credentials, and log levels", () => {
    expect(runtimeConfigurationScript).toContain(
      "123456789012.dkr.ecr.us-east-1.amazonaws.com/finhand-prod-web-ecr",
    );
    expect(runtimeConfigurationScript).toContain(
      "123456789012.dkr.ecr.us-east-1.amazonaws.com/finhand-prod-api-ecr",
    );
    expect(runtimeConfigurationScript).toContain("^[0-9a-f]{40}$");
    expect(runtimeConfigurationScript).toContain(
      "database/password must contain 32-128 URL-safe characters.",
    );
    expect(runtimeConfigurationScript).toContain(
      "The web and API domains must be different.",
    );
    expect(runtimeConfigurationScript).toContain(
      "The web and API images must use the same Git commit SHA tag.",
    );
    expect(runtimeConfigurationScript).toContain(
      "trace|debug|info|warn|error|fatal|silent)",
    );
  });

  it("gives each service only its required runtime values", () => {
    const apiWrites = runtimeConfigurationScript
      .split("\n")
      .filter((line) => line.includes('write_environment_value "$api_file"'));
    const workerWrites = runtimeConfigurationScript
      .split("\n")
      .filter((line) =>
        line.includes('write_environment_value "$worker_file"'),
      );
    const postgresWrites = runtimeConfigurationScript
      .split("\n")
      .filter((line) =>
        line.includes('write_environment_value "$postgres_file"'),
      );
    const migrationWrites = runtimeConfigurationScript
      .split("\n")
      .filter((line) =>
        line.includes('write_environment_value "$migration_file"'),
      );

    expect(apiWrites.join("\n")).not.toContain("OPENAI_API_KEY");
    expect(workerWrites.join("\n")).not.toContain("BETTER_AUTH_SECRET");
    expect(workerWrites.join("\n")).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(migrationWrites).toHaveLength(1);
    expect(migrationWrites.join("\n")).toContain("DATABASE_URL");
    expect(postgresWrites).toHaveLength(3);
    expect(postgresWrites.join("\n")).toContain("POSTGRES_PASSWORD");
  });

  it("installs five protected files without printing their values", () => {
    for (const fileName of [
      "deployment.env",
      "api.env",
      "worker.env",
      "migration.env",
      "postgres.env",
    ]) {
      expect(runtimeConfigurationScript).toContain(fileName);
    }

    expect(runtimeConfigurationScript).toContain(
      'install -o root -g root -m 0600 "$temporary_directory/$file"',
    );
    expect(runtimeConfigurationScript).not.toContain("AWS_ACCESS_KEY_ID");
    expect(runtimeConfigurationScript).not.toContain(
      "AWS_SECRET_ACCESS_KEY",
    );
    expect(runtimeConfigurationScript).not.toMatch(
      /echo[^\n]*\$(?:database_password|better_auth_secret|google_client_secret|openai_api_key)/u,
    );
  });

  it("wraps the renderer in a bounded Systems Manager command document", () => {
    expect(createRuntimeConfigurationDocumentContent(scriptOptions)).toEqual({
      schemaVersion: "2.2",
      description:
        "Render protected FinHand production environment files from Parameter Store.",
      mainSteps: [
        {
          action: "aws:runShellScript",
          name: "renderRuntimeConfiguration",
          inputs: {
            timeoutSeconds: "180",
            runCommand: [runtimeConfigurationScript],
          },
        },
      ],
    });
  });
});
