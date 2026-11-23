export const FINHAND_METRICS_NAMESPACE = "FinHand/Production";

export const CLOUDWATCH_AGENT_CONFIG_PATH =
  "/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json";

export const CLOUDWATCH_AGENT_CONFIG = JSON.stringify(
  {
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
  },
  null,
  2,
);

export const CONTAINER_HEALTH_SCRIPT_PATH =
  "/opt/finhand/bin/publish-container-health";
export const CONTAINER_HEALTH_SERVICE_NAME =
  "finhand-container-health.service";
export const CONTAINER_HEALTH_TIMER_NAME = "finhand-container-health.timer";

export const CONTAINER_HEALTH_SCRIPT = `#!/usr/bin/env bash
set -Eeuo pipefail

readonly AWS_REGION="us-east-1"
readonly METRICS_NAMESPACE="${FINHAND_METRICS_NAMESPACE}"
readonly COMPOSE_PROJECT="finhand-production"
readonly EXPECTED_SERVICES=(proxy web api worker postgres)

healthy_count=0
unhealthy_count=0
unhealthy_services=()

for service_name in "\${EXPECTED_SERVICES[@]}"; do
  container_id=$(docker ps --all \
    --filter "label=com.docker.compose.project=\${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=\${service_name}" \
    --quiet | head -n 1)

  if [[ -z "\${container_id}" ]]; then
    ((unhealthy_count += 1))
    unhealthy_services+=("\${service_name}:missing")
    continue
  fi

  read -r container_status health_status < <(
    docker inspect "\${container_id}" | \
      jq --raw-output \
        '.[0].State | [.Status, (.Health.Status // "missing")] | @tsv'
  )

  if [[ "\${container_status}" == "running" && "\${health_status}" == "healthy" ]]; then
    ((healthy_count += 1))
  else
    ((unhealthy_count += 1))
    unhealthy_services+=("\${service_name}:\${container_status}/\${health_status}")
  fi
done

aws cloudwatch put-metric-data \
  --region "\${AWS_REGION}" \
  --namespace "\${METRICS_NAMESPACE}" \
  --metric-data \
    "MetricName=HealthyContainerCount,Value=\${healthy_count},Unit=Count" \
    "MetricName=UnhealthyOrMissingContainerCount,Value=\${unhealthy_count},Unit=Count"

if (( unhealthy_count > 0 )); then
  printf 'Container health published: healthy=%d unhealthy_or_missing=%d details=%s\n' \
    "\${healthy_count}" \
    "\${unhealthy_count}" \
    "\${unhealthy_services[*]}"
else
  printf 'Container health published: healthy=%d unhealthy_or_missing=0\n' \
    "\${healthy_count}"
fi
`;

export const CONTAINER_HEALTH_SERVICE = `[Unit]
Description=Publish FinHand production container health metrics
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=oneshot
ExecStart=${CONTAINER_HEALTH_SCRIPT_PATH}
`;

export const CONTAINER_HEALTH_TIMER = `[Unit]
Description=Publish FinHand production container health metrics every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=${CONTAINER_HEALTH_SERVICE_NAME}

[Install]
WantedBy=timers.target
`;
