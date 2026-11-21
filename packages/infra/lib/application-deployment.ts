import { createHash } from "node:crypto";

interface ApplicationDeploymentScriptOptions {
  accountId: string;
  backupBucketName: string;
  caddyConfiguration: string;
  composeConfiguration: string;
  region: string;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export function createApplicationDeploymentScript({
  accountId,
  backupBucketName,
  caddyConfiguration,
  composeConfiguration,
  region,
}: ApplicationDeploymentScriptOptions): string {
  const registry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  const deploymentRevision = createHash("sha256")
    .update(composeConfiguration)
    .update(caddyConfiguration)
    .digest("hex")
    .slice(0, 16);

  return [
    "#!/usr/bin/env bash",
    "set -Eeuo pipefail",
    "",
    "trap 'echo \"Application deployment failed at line ${LINENO}.\" >&2' ERR",
    "",
    'CONFIGURATION_DIRECTORY="/opt/finhand/config"',
    'DEPLOYMENT_ENVIRONMENT="$CONFIGURATION_DIRECTORY/deployment.env"',
    'RELEASES_DIRECTORY="/opt/finhand/releases"',
    'CURRENT_RELEASE="/opt/finhand/current"',
    'RUNTIME_DIRECTORY="/opt/finhand/runtime"',
    `AWS_REGION="${region}"`,
    `ECR_REGISTRY="${registry}"`,
    `BACKUP_BUCKET="${backupBucketName}"`,
    `DEPLOYMENT_REVISION="${deploymentRevision}"`,
    `COMPOSE_CONFIGURATION="${encode(composeConfiguration)}"`,
    `CADDY_CONFIGURATION="${encode(caddyConfiguration)}"`,
    "",
    "if [[ $(id -u) -ne 0 ]]; then",
    '  echo "Application deployment must run as root." >&2',
    "  exit 1",
    "fi",
    "",
    'install -d -o root -g root -m 0750 "$RUNTIME_DIRECTORY"',
    'exec 9>"$RUNTIME_DIRECTORY/deployment.lock"',
    "if ! flock --nonblock 9; then",
    '  echo "Another FinHand deployment is already running." >&2',
    "  exit 1",
    "fi",
    "",
    "for required_file in deployment.env api.env worker.env migration.env postgres.env; do",
    '  if [[ ! -f "$CONFIGURATION_DIRECTORY/$required_file" ]]; then',
    '    echo "Missing runtime configuration file: $required_file" >&2',
    "    exit 1",
    "  fi",
    "done",
    "",
    "set -a",
    'source "$DEPLOYMENT_ENVIRONMENT"',
    "set +a",
    "",
    'web_release="${FINHAND_WEB_IMAGE##*:}"',
    'api_release="${FINHAND_API_IMAGE##*:}"',
    'if [[ ! "$web_release" =~ ^[0-9a-f]{40}$ || "$web_release" != "$api_release" ]]; then',
    '  echo "Configured images must use the same full Git commit SHA." >&2',
    "  exit 1",
    "fi",
    'release_directory="$RELEASES_DIRECTORY/${web_release}-${DEPLOYMENT_REVISION}"',
    'temporary_directory=$(mktemp -d "$RUNTIME_DIRECTORY/.deployment.XXXXXX")',
    'trap \'rm -rf "$temporary_directory"\' EXIT',
    'export DOCKER_CONFIG="$temporary_directory/docker"',
    'install -d -o root -g root -m 0700 "$DOCKER_CONFIG"',
    "",
    'printf "%s" "$COMPOSE_CONFIGURATION" | base64 --decode > "$temporary_directory/compose.yaml"',
    'printf "%s" "$CADDY_CONFIGURATION" | base64 --decode > "$temporary_directory/Caddyfile"',
    'docker compose --env-file "$DEPLOYMENT_ENVIRONMENT" --file "$temporary_directory/compose.yaml" config --quiet',
    "",
    'if [[ -d "$release_directory" ]]; then',
    '  cmp --silent "$temporary_directory/compose.yaml" "$release_directory/compose.yaml"',
    '  cmp --silent "$temporary_directory/Caddyfile" "$release_directory/Caddyfile"',
    "else",
    '  install -d -o root -g root -m 0755 "$release_directory"',
    '  install -o root -g root -m 0644 "$temporary_directory/compose.yaml" "$release_directory/compose.yaml"',
    '  install -o root -g root -m 0644 "$temporary_directory/Caddyfile" "$release_directory/Caddyfile"',
    "fi",
    "",
    'compose=(docker compose --env-file "$DEPLOYMENT_ENVIRONMENT" --file "$release_directory/compose.yaml")',
    'aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"',
    '"${compose[@]}" --profile deployment pull',
    '"${compose[@]}" up --detach --wait --wait-timeout 180 postgres',
    "",
    'backup_timestamp=$(date --utc +%Y%m%dT%H%M%SZ)',
    'backup_path="$temporary_directory/${backup_timestamp}-${web_release}.dump"',
    'backup_key="database/${backup_timestamp}-${web_release}.dump"',
    '"${compose[@]}" exec -T postgres sh -c \'pg_dump --format=custom --username "$POSTGRES_USER" "$POSTGRES_DB"\' > "$backup_path"',
    '"${compose[@]}" exec -T postgres pg_restore --list < "$backup_path" > /dev/null',
    'aws s3 cp "$backup_path" "s3://${BACKUP_BUCKET}/${backup_key}" --only-show-errors --sse AES256',
    "",
    '"${compose[@]}" --profile deployment run --rm migrate',
    "",
    'previous_release=$(readlink --canonicalize "$CURRENT_RELEASE" 2>/dev/null || true)',
    'next_link="$temporary_directory/current"',
    'ln -s "$release_directory" "$next_link"',
    'mv --force --no-target-directory "$next_link" "$CURRENT_RELEASE"',
    'current_compose=(docker compose --env-file "$DEPLOYMENT_ENVIRONMENT" --file "$CURRENT_RELEASE/compose.yaml")',
    "",
    'if ! "${current_compose[@]}" up --detach --remove-orphans --wait --wait-timeout 180 web api worker postgres ||',
    '   ! "${current_compose[@]}" up --detach --no-deps --force-recreate --wait --wait-timeout 180 proxy; then',
    '  if [[ -n "$previous_release" && -f "$previous_release/compose.yaml" ]]; then',
    '    rollback_link="$temporary_directory/rollback"',
    '    ln -s "$previous_release" "$rollback_link"',
    '    mv --force --no-target-directory "$rollback_link" "$CURRENT_RELEASE"',
    '    rollback_compose=(docker compose --env-file "$DEPLOYMENT_ENVIRONMENT" --file "$CURRENT_RELEASE/compose.yaml")',
    '    "${rollback_compose[@]}" up --detach --remove-orphans --wait --wait-timeout 180 web api worker postgres || true',
    '    "${rollback_compose[@]}" up --detach --no-deps --force-recreate --wait --wait-timeout 180 proxy || true',
    "  fi",
    "  exit 1",
    "fi",
    "",
    'echo "FinHand release $web_release deployed successfully; backup stored at s3://${BACKUP_BUCKET}/${backup_key}."',
  ].join("\n");
}

export function createApplicationDeploymentDocumentContent(
  options: ApplicationDeploymentScriptOptions,
): Record<string, unknown> {
  return {
    schemaVersion: "2.2",
    description:
      "Deploy an approved FinHand release with backup, migration, health checks, and container rollback.",
    mainSteps: [
      {
        action: "aws:runShellScript",
        name: "deployApplication",
        inputs: {
          timeoutSeconds: "900",
          runCommand: [createApplicationDeploymentScript(options)],
        },
      },
    ],
  };
}
