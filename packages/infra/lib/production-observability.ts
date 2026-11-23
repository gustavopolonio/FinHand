import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import { FINHAND_METRICS_NAMESPACE } from "./host-monitoring.js";

export const PRODUCTION_ALERT_EMAIL_PARAMETER_NAME =
  "/finhand/production/monitoring/alert-email";

interface CreateProductionObservabilityOptions {
  alertEmail: string;
  hostInstanceId: string;
}

export interface ProductionObservability {
  alertTopic: sns.Topic;
  dashboard: cloudwatch.Dashboard;
}

function createCustomMetric(
  metricName: string,
  options: {
    dimensionsMap?: Record<string, string>;
    label: string;
    period?: Duration;
    statistic: string;
    unit: cloudwatch.Unit;
  },
): cloudwatch.Metric {
  return new cloudwatch.Metric({
    dimensionsMap: options.dimensionsMap,
    label: options.label,
    metricName,
    namespace: FINHAND_METRICS_NAMESPACE,
    period: options.period ?? Duration.minutes(1),
    statistic: options.statistic,
    unit: options.unit,
  });
}

export function createProductionObservability(
  scope: Construct,
  { alertEmail, hostInstanceId }: CreateProductionObservabilityOptions,
): ProductionObservability {
  const alertTopic = new sns.Topic(scope, "ProductionAlertTopic", {
    displayName: "FinHand production alerts",
    topicName: "finhand-production-alerts",
  });
  alertTopic.addSubscription(
    new subscriptions.EmailSubscription(alertEmail),
  );
  const alarmAction = new cloudwatchActions.SnsAction(alertTopic);

  const ec2Dimensions = { InstanceId: hostInstanceId };
  const cpuMetric = new cloudwatch.Metric({
    dimensionsMap: ec2Dimensions,
    label: "EC2 CPU",
    metricName: "CPUUtilization",
    namespace: "AWS/EC2",
    period: Duration.minutes(5),
    statistic: "Average",
    unit: cloudwatch.Unit.PERCENT,
  });
  const hostStatusMetric = new cloudwatch.Metric({
    dimensionsMap: ec2Dimensions,
    label: "EC2 failed status checks",
    metricName: "StatusCheckFailed",
    namespace: "AWS/EC2",
    period: Duration.minutes(1),
    statistic: "Maximum",
    unit: cloudwatch.Unit.COUNT,
  });
  const memoryMetric = createCustomMetric("mem_used_percent", {
    dimensionsMap: ec2Dimensions,
    label: "Memory used",
    statistic: "Average",
    unit: cloudwatch.Unit.PERCENT,
  });
  const rootDiskMetric = createCustomMetric("disk_used_percent", {
    dimensionsMap: {
      ...ec2Dimensions,
      fstype: "xfs",
      path: "/",
    },
    label: "Root disk used",
    statistic: "Maximum",
    unit: cloudwatch.Unit.PERCENT,
  });
  const databaseDiskMetric = createCustomMetric("disk_used_percent", {
    dimensionsMap: {
      ...ec2Dimensions,
      fstype: "ext4",
      path: "/srv/finhand/postgres",
    },
    label: "PostgreSQL disk used",
    statistic: "Maximum",
    unit: cloudwatch.Unit.PERCENT,
  });
  const healthyContainerMetric = createCustomMetric(
    "HealthyContainerCount",
    {
      label: "Healthy containers",
      statistic: "Minimum",
      unit: cloudwatch.Unit.COUNT,
    },
  );
  const unhealthyContainerMetric = createCustomMetric(
    "UnhealthyOrMissingContainerCount",
    {
      label: "Unhealthy or missing containers",
      statistic: "Maximum",
      unit: cloudwatch.Unit.COUNT,
    },
  );
  const apiFailureMetric = createCustomMetric("ApiUnhandledErrorCount", {
    label: "Unhandled API errors",
    period: Duration.minutes(5),
    statistic: "Sum",
    unit: cloudwatch.Unit.COUNT,
  });
  const workerFailureMetric = createCustomMetric(
    "WorkerUnexpectedErrorCount",
    {
      label: "Unexpected worker errors",
      period: Duration.minutes(5),
      statistic: "Sum",
      unit: cloudwatch.Unit.COUNT,
    },
  );
  const aiFailureMetric = createCustomMetric("AiProviderFailureCount", {
    label: "AI provider failures",
    period: Duration.minutes(15),
    statistic: "Sum",
    unit: cloudwatch.Unit.COUNT,
  });

  const alarms = [
    new cloudwatch.Alarm(scope, "HostStatusAlarm", {
      alarmDescription:
        "The production EC2 host failed an instance or system status check.",
      alarmName: "finhand-production-host-status-failed",
      datapointsToAlarm: 2,
      evaluationPeriods: 2,
      metric: hostStatusMetric,
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    }),
    new cloudwatch.Alarm(scope, "MemoryUsageAlarm", {
      alarmDescription:
        "Production memory usage remained at or above 85 percent, or memory metrics stopped.",
      alarmName: "finhand-production-memory-high",
      datapointsToAlarm: 5,
      evaluationPeriods: 5,
      metric: memoryMetric,
      threshold: 85,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    }),
    new cloudwatch.Alarm(scope, "RootDiskUsageAlarm", {
      alarmDescription:
        "The production root disk remained at or above 85 percent, or disk metrics stopped.",
      alarmName: "finhand-production-root-disk-high",
      datapointsToAlarm: 3,
      evaluationPeriods: 3,
      metric: rootDiskMetric,
      threshold: 85,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    }),
    new cloudwatch.Alarm(scope, "DatabaseDiskUsageAlarm", {
      alarmDescription:
        "The PostgreSQL data disk remained at or above 80 percent, or disk metrics stopped.",
      alarmName: "finhand-production-database-disk-high",
      datapointsToAlarm: 3,
      evaluationPeriods: 3,
      metric: databaseDiskMetric,
      threshold: 80,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    }),
    new cloudwatch.Alarm(scope, "ContainerHealthAlarm", {
      alarmDescription:
        "A production container remained unhealthy or missing, or its health metric stopped.",
      alarmName: "finhand-production-container-unhealthy",
      datapointsToAlarm: 2,
      evaluationPeriods: 2,
      metric: unhealthyContainerMetric,
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    }),
    new cloudwatch.Alarm(scope, "ApiUnhandledErrorAlarm", {
      alarmDescription:
        "The production API emitted at least one unexpected unhandled error.",
      alarmName: "finhand-production-api-unhandled-error",
      evaluationPeriods: 1,
      metric: apiFailureMetric,
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }),
    new cloudwatch.Alarm(scope, "WorkerUnexpectedErrorAlarm", {
      alarmDescription:
        "The production worker emitted at least one unexpected runtime error.",
      alarmName: "finhand-production-worker-unexpected-error",
      evaluationPeriods: 1,
      metric: workerFailureMetric,
      threshold: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }),
    new cloudwatch.Alarm(scope, "AiProviderFailureAlarm", {
      alarmDescription:
        "At least three technical OpenAI provider failures occurred within 15 minutes.",
      alarmName: "finhand-production-ai-provider-failures",
      evaluationPeriods: 1,
      metric: aiFailureMetric,
      threshold: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }),
  ];

  for (const alarm of alarms) {
    alarm.addAlarmAction(alarmAction);
  }

  const dashboard = new cloudwatch.Dashboard(scope, "ProductionDashboard", {
    dashboardName: "finhand-production",
    defaultInterval: Duration.hours(6),
    periodOverride: cloudwatch.PeriodOverride.INHERIT,
  });
  dashboard.addWidgets(
    new cloudwatch.AlarmStatusWidget({
      alarms,
      height: 4,
      title: "Production alarms",
      width: 24,
    }),
  );
  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      height: 6,
      left: [cpuMetric, memoryMetric],
      leftYAxis: { max: 100, min: 0, showUnits: false },
      title: "Host CPU and memory",
      width: 12,
    }),
    new cloudwatch.GraphWidget({
      height: 6,
      left: [rootDiskMetric, databaseDiskMetric],
      leftYAxis: { max: 100, min: 0, showUnits: false },
      title: "Filesystem usage",
      width: 12,
    }),
  );
  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      height: 6,
      left: [healthyContainerMetric, unhealthyContainerMetric],
      leftYAxis: { min: 0, showUnits: false },
      title: "Container health",
      width: 12,
    }),
    new cloudwatch.GraphWidget({
      height: 6,
      left: [apiFailureMetric, workerFailureMetric, aiFailureMetric],
      leftYAxis: { min: 0, showUnits: false },
      title: "Critical application failures",
      width: 12,
    }),
  );

  return { alertTopic, dashboard };
}
