#!/usr/bin/env bash

set -Eeuo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECR_REGISTRY:?ECR_REGISTRY is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "RELEASE_SHA must be a full lowercase Git commit SHA." >&2
  exit 1
fi

readonly WEB_IMAGE_PARAMETER="/finhand/production/deployment/web-image"
readonly API_IMAGE_PARAMETER="/finhand/production/deployment/api-image"
readonly RUNTIME_CONFIGURATION_DOCUMENT="finhand-prod-render-runtime-config"
readonly APPLICATION_DEPLOYMENT_DOCUMENT="finhand-prod-deploy-application"
readonly PRODUCTION_HOST_TARGET="Key=tag:Name,Values=finhand-prod-host"
readonly WEB_IMAGE="${ECR_REGISTRY}/finhand-prod-web-ecr:${RELEASE_SHA}"
readonly API_IMAGE="${ECR_REGISTRY}/finhand-prod-api-ecr:${RELEASE_SHA}"

previous_web_image=""
previous_api_image=""
parameters_updated=false

get_parameter() {
  aws ssm get-parameter \
    --region "$AWS_REGION" \
    --name "$1" \
    --query "Parameter.Value" \
    --output text
}

put_parameter() {
  aws ssm put-parameter \
    --region "$AWS_REGION" \
    --name "$1" \
    --type String \
    --value "$2" \
    --overwrite \
    --no-cli-pager > /dev/null
}

show_command_result() {
  aws ssm list-command-invocations \
    --region "$AWS_REGION" \
    --command-id "$1" \
    --details \
    --query "CommandInvocations[].{InstanceId:InstanceId,Status:Status,StatusDetails:StatusDetails}" \
    --output table \
    --no-cli-pager || true
}

run_ssm_document() {
  local document_name="$1"
  local timeout_seconds="$2"
  local command_id
  local deadline
  local status

  command_id=$(aws ssm send-command \
    --region "$AWS_REGION" \
    --document-name "$document_name" \
    --targets "$PRODUCTION_HOST_TARGET" \
    --max-concurrency "1" \
    --max-errors "0" \
    --timeout-seconds "$timeout_seconds" \
    --comment "FinHand release ${RELEASE_SHA}" \
    --query "Command.CommandId" \
    --output text \
    --no-cli-pager)

  echo "Started ${document_name} with command ${command_id}."
  deadline=$((SECONDS + timeout_seconds + 180))

  while (( SECONDS < deadline )); do
    status=$(aws ssm list-command-invocations \
      --region "$AWS_REGION" \
      --command-id "$command_id" \
      --details \
      --query "CommandInvocations[0].Status" \
      --output text \
      --no-cli-pager)

    case "$status" in
      Success)
        show_command_result "$command_id"
        return 0
        ;;
      Pending|InProgress|Delayed|None|"")
        sleep 10
        ;;
      *)
        echo "${document_name} failed with status ${status}." >&2
        show_command_result "$command_id"
        return 1
        ;;
    esac
  done

  echo "Timed out waiting for ${document_name}." >&2
  show_command_result "$command_id"
  return 1
}

restore_previous_parameters() {
  local exit_code=$?

  trap - ERR
  if [[ "$parameters_updated" == "true" ]]; then
    echo "Restoring the previous production image parameters." >&2
    set +e
    put_parameter "$WEB_IMAGE_PARAMETER" "$previous_web_image"
    put_parameter "$API_IMAGE_PARAMETER" "$previous_api_image"
    run_ssm_document "$RUNTIME_CONFIGURATION_DOCUMENT" 300
    set -e
  fi

  exit "$exit_code"
}

trap restore_previous_parameters ERR

previous_web_image=$(get_parameter "$WEB_IMAGE_PARAMETER")
previous_api_image=$(get_parameter "$API_IMAGE_PARAMETER")
parameters_updated=true

put_parameter "$WEB_IMAGE_PARAMETER" "$WEB_IMAGE"
put_parameter "$API_IMAGE_PARAMETER" "$API_IMAGE"

run_ssm_document "$RUNTIME_CONFIGURATION_DOCUMENT" 300
run_ssm_document "$APPLICATION_DEPLOYMENT_DOCUMENT" 900

parameters_updated=false
trap - ERR

echo "FinHand release ${RELEASE_SHA} deployed successfully."

