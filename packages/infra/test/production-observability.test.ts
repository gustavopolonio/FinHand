import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { PRODUCTION_ALERT_EMAIL_PARAMETER_NAME } from "../lib/production-observability.js";
import { ProductionStack } from "../lib/production-stack.js";

const productionEnvironment = {
  account: "123456789012",
  region: "us-east-1",
};

function createTemplate(): Template {
  const app = new App();
  const stack = new ProductionStack(app, "TestProductionStack", {
    env: productionEnvironment,
  });

  return Template.fromStack(stack);
}

describe("production observability", () => {
  it("subscribes the SSM-resolved alert contact without committing its value", () => {
    const template = createTemplate();
    const templateJson = template.toJSON();
    const alertEmailParameter = Object.values(
      templateJson.Parameters ?? {},
    ).find(
      (parameter) =>
        (parameter as { Default?: string }).Default ===
        PRODUCTION_ALERT_EMAIL_PARAMETER_NAME,
    ) as { Default: string; Type: string } | undefined;

    expect(alertEmailParameter).toEqual({
      Default: PRODUCTION_ALERT_EMAIL_PARAMETER_NAME,
      Type: "AWS::SSM::Parameter::Value<String>",
    });
    template.resourceCountIs("AWS::SNS::Topic", 1);
    template.hasResourceProperties("AWS::SNS::Topic", {
      DisplayName: "FinHand production alerts",
      TopicName: "finhand-production-alerts",
    });
    template.resourceCountIs("AWS::SNS::Subscription", 1);
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Endpoint: { Ref: Match.stringLikeRegexp("^SsmParameterValue") },
      Protocol: "email",
      TopicArn: { Ref: Match.stringLikeRegexp("^ProductionAlertTopic") },
    });
    expect(JSON.stringify(templateJson)).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    );
  });

  it("creates eight actionable alarms with one notification action", () => {
    const template = createTemplate();
    const alarmResources = template.findResources("AWS::CloudWatch::Alarm");
    const alarms = Object.values(alarmResources);

    expect(alarms).toHaveLength(8);
    const expectedAlarms = {
      "finhand-production-ai-provider-failures": {
        datapointsToAlarm: undefined,
        evaluationPeriods: 1,
        metricName: "AiProviderFailureCount",
        period: 900,
        threshold: 3,
        treatMissingData: "notBreaching",
      },
      "finhand-production-api-unhandled-error": {
        datapointsToAlarm: undefined,
        evaluationPeriods: 1,
        metricName: "ApiUnhandledErrorCount",
        period: 300,
        threshold: 1,
        treatMissingData: "notBreaching",
      },
      "finhand-production-container-unhealthy": {
        datapointsToAlarm: 2,
        evaluationPeriods: 2,
        metricName: "UnhealthyOrMissingContainerCount",
        period: 60,
        threshold: 1,
        treatMissingData: "breaching",
      },
      "finhand-production-database-disk-high": {
        datapointsToAlarm: 3,
        evaluationPeriods: 3,
        metricName: "disk_used_percent",
        period: 60,
        threshold: 80,
        treatMissingData: "breaching",
      },
      "finhand-production-host-status-failed": {
        datapointsToAlarm: 2,
        evaluationPeriods: 2,
        metricName: "StatusCheckFailed",
        period: 60,
        threshold: 1,
        treatMissingData: "breaching",
      },
      "finhand-production-memory-high": {
        datapointsToAlarm: 5,
        evaluationPeriods: 5,
        metricName: "mem_used_percent",
        period: 60,
        threshold: 85,
        treatMissingData: "breaching",
      },
      "finhand-production-root-disk-high": {
        datapointsToAlarm: 3,
        evaluationPeriods: 3,
        metricName: "disk_used_percent",
        period: 60,
        threshold: 85,
        treatMissingData: "breaching",
      },
      "finhand-production-worker-unexpected-error": {
        datapointsToAlarm: undefined,
        evaluationPeriods: 1,
        metricName: "WorkerUnexpectedErrorCount",
        period: 300,
        threshold: 1,
        treatMissingData: "notBreaching",
      },
    } as const;

    for (const [alarmName, expected] of Object.entries(expectedAlarms)) {
      const alarm = alarms.find(
        (candidate) => candidate.Properties.AlarmName === alarmName,
      );

      expect(alarm, `Missing alarm ${alarmName}`).toBeDefined();
      expect(alarm?.Properties).toMatchObject({
        AlarmActions: [{ Ref: expect.stringMatching(/^ProductionAlertTopic/) }],
        ComparisonOperator: "GreaterThanOrEqualToThreshold",
        EvaluationPeriods: expected.evaluationPeriods,
        Threshold: expected.threshold,
        TreatMissingData: expected.treatMissingData,
      });
      expect(alarm?.Properties.DatapointsToAlarm).toBe(
        expected.datapointsToAlarm,
      );
      expect(alarm?.Properties.Metrics).toHaveLength(1);
      expect(
        alarm?.Properties.Metrics[0].MetricStat.Metric.MetricName,
      ).toBe(expected.metricName);
      expect(alarm?.Properties.Metrics[0].MetricStat.Period).toBe(
        expected.period,
      );
      expect(alarm?.Properties).not.toHaveProperty("OKActions");
      expect(alarm?.Properties).not.toHaveProperty(
        "InsufficientDataActions",
      );
    }
  });

  it("creates one compact dashboard for alarms, resources, containers, and failures", () => {
    const template = createTemplate();
    const dashboards = template.findResources("AWS::CloudWatch::Dashboard");
    const [dashboard] = Object.values(dashboards);
    const dashboardBody = JSON.stringify(dashboard.Properties.DashboardBody);

    expect(Object.keys(dashboards)).toHaveLength(1);
    expect(dashboard.Properties.DashboardName).toBe("finhand-production");
    for (const expectedValue of [
      "Production alarms",
      "Host CPU and memory",
      "Filesystem usage",
      "Container health",
      "Critical application failures",
      "CPUUtilization",
      "mem_used_percent",
      "disk_used_percent",
      "HealthyContainerCount",
      "UnhealthyOrMissingContainerCount",
      "ApiUnhandledErrorCount",
      "WorkerUnexpectedErrorCount",
      "AiProviderFailureCount",
    ]) {
      expect(dashboardBody).toContain(expectedValue);
    }
  });
});
