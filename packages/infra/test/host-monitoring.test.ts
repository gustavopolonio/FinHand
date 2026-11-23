import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLOUDWATCH_AGENT_CONFIG,
  CLOUDWATCH_AGENT_CONFIG_PATH,
  CONTAINER_HEALTH_SCRIPT,
  CONTAINER_HEALTH_SCRIPT_PATH,
  CONTAINER_HEALTH_SERVICE,
  CONTAINER_HEALTH_SERVICE_NAME,
  CONTAINER_HEALTH_TIMER,
  CONTAINER_HEALTH_TIMER_NAME,
  FINHAND_METRICS_NAMESPACE,
} from "../lib/host-monitoring.js";

describe("production host monitoring", () => {
  it("collects memory and bounded filesystem metrics every minute", () => {
    const config = JSON.parse(CLOUDWATCH_AGENT_CONFIG) as {
      agent: Record<string, unknown>;
      metrics: Record<string, unknown>;
    };

    expect(CLOUDWATCH_AGENT_CONFIG_PATH).toBe(
      "/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json",
    );
    expect(config).toEqual({
      agent: {
        metrics_collection_interval: 60,
        run_as_user: "root",
      },
      metrics: {
        append_dimensions: {
          InstanceId: "${aws:InstanceId}",
        },
        metrics_collected: {
          disk: {
            drop_device: true,
            measurement: ["used_percent"],
            metrics_collection_interval: 60,
            resources: ["/", "/srv/finhand/postgres"],
          },
          mem: {
            measurement: ["mem_used_percent"],
            metrics_collection_interval: 60,
          },
        },
        namespace: FINHAND_METRICS_NAMESPACE,
      },
    });
  });

  it("publishes aggregate health for only the five long-running containers", () => {
    const syntaxCheck = spawnSync("bash", ["-n"], {
      encoding: "utf8",
      input: CONTAINER_HEALTH_SCRIPT,
    });

    expect(syntaxCheck.stderr).toBe("");
    expect(syntaxCheck.status).toBe(0);
    expect(CONTAINER_HEALTH_SCRIPT_PATH).toBe(
      "/opt/finhand/bin/publish-container-health",
    );
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      "readonly EXPECTED_SERVICES=(proxy web api worker postgres)",
    );
    expect(CONTAINER_HEALTH_SCRIPT).not.toContain("EXPECTED_SERVICES=(migrate");
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      'label=com.docker.compose.project=${COMPOSE_PROJECT}',
    );
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      'label=com.docker.compose.service=${service_name}',
    );
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      "MetricName=HealthyContainerCount",
    );
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      "MetricName=UnhealthyOrMissingContainerCount",
    );
    expect(CONTAINER_HEALTH_SCRIPT).toContain(
      `readonly METRICS_NAMESPACE="${FINHAND_METRICS_NAMESPACE}"`,
    );
  });

  it("counts unhealthy and missing containers in the published metrics", () => {
    const mockDirectory = mkdtempSync(join(tmpdir(), "finhand-monitoring-"));
    const dockerPath = join(mockDirectory, "docker");
    const awsPath = join(mockDirectory, "aws");
    const metricOutputPath = join(mockDirectory, "metric-output");

    try {
      writeFileSync(
        dockerPath,
        `#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$1" == "ps" ]]; then
  service_name=""
  for argument in "$@"; do
    if [[ "$argument" == label=com.docker.compose.service=* ]]; then
      service_name="\${argument##*=}"
    fi
  done
  if [[ "$service_name" != "worker" ]]; then
    printf '%s-container\\n' "$service_name"
  fi
  exit 0
fi

if [[ "$1" == "inspect" ]]; then
  container_id="$2"
  if [[ "$container_id" == "api-container" ]]; then
    printf '[{"State":{"Status":"exited","Health":{"Status":"unhealthy"}}}]\\n'
  else
    printf '[{"State":{"Status":"running","Health":{"Status":"healthy"}}}]\\n'
  fi
  exit 0
fi

exit 1
`,
      );
      writeFileSync(
        awsPath,
        `#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\\n' "$*" > "$METRIC_OUTPUT_PATH"
`,
      );
      chmodSync(dockerPath, 0o755);
      chmodSync(awsPath, 0o755);

      const result = spawnSync("bash", [], {
        encoding: "utf8",
        env: {
          ...process.env,
          METRIC_OUTPUT_PATH: metricOutputPath,
          PATH: `${mockDirectory}:${process.env.PATH ?? ""}`,
        },
        input: CONTAINER_HEALTH_SCRIPT,
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "healthy=3 unhealthy_or_missing=2 details=api:exited/unhealthy worker:missing",
      );
      expect(readFileSync(metricOutputPath, "utf8")).toContain(
        "MetricName=HealthyContainerCount,Value=3,Unit=Count " +
          "MetricName=UnhealthyOrMissingContainerCount,Value=2,Unit=Count",
      );
    } finally {
      rmSync(mockDirectory, { force: true, recursive: true });
    }
  });

  it("runs the container-health publisher through a persistent systemd timer", () => {
    expect(CONTAINER_HEALTH_SERVICE_NAME).toBe(
      "finhand-container-health.service",
    );
    expect(CONTAINER_HEALTH_TIMER_NAME).toBe("finhand-container-health.timer");
    expect(CONTAINER_HEALTH_SERVICE).toContain(
      `ExecStart=${CONTAINER_HEALTH_SCRIPT_PATH}`,
    );
    expect(CONTAINER_HEALTH_SERVICE).toContain("Type=oneshot");
    expect(CONTAINER_HEALTH_TIMER).toContain("OnBootSec=2min");
    expect(CONTAINER_HEALTH_TIMER).toContain("OnUnitActiveSec=60s");
    expect(CONTAINER_HEALTH_TIMER).toContain("Persistent=true");
    expect(CONTAINER_HEALTH_TIMER).toContain(
      `Unit=${CONTAINER_HEALTH_SERVICE_NAME}`,
    );
  });
});
