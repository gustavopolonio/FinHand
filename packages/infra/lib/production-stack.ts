import {
  ArnFormat,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Size,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Construct } from "constructs";
import { createApplicationDeploymentDocumentContent } from "./application-deployment.js";
import {
  createHostBootstrapDocumentContent,
  HOST_BOOTSTRAP_REVISION,
} from "./host-bootstrap.js";
import { FINHAND_METRICS_NAMESPACE } from "./host-monitoring.js";
import {
  PRODUCTION_HOST_AMI_PARAMETER_NAME,
  PRODUCTION_HOST_AMI_PARAMETER_VERSION,
} from "./production-ami.js";
import {
  createProductionObservability,
  PRODUCTION_ALERT_EMAIL_PARAMETER_NAME,
} from "./production-observability.js";
import {
  createRuntimeConfigurationDocumentContent,
  runtimeParameterRoot,
} from "./runtime-configuration.js";

const PRODUCTION_REGION = "us-east-1";
const GITHUB_ACTIONS_SUBJECT =
  "repo:gustavopolonio@69776883/FinHand@1441112950:environment:production";
const PRODUCTION_CONTAINER_LOG_GROUPS = [
  { id: "ProxyLogGroup", name: "/finhand/production/proxy" },
  { id: "WebLogGroup", name: "/finhand/production/web" },
  { id: "ApiLogGroup", name: "/finhand/production/api" },
  { id: "WorkerLogGroup", name: "/finhand/production/worker" },
  { id: "MigrationLogGroup", name: "/finhand/production/migrate" },
  { id: "PostgresLogGroup", name: "/finhand/production/postgres" },
] as const;
const API_UNHANDLED_ERROR_METRIC_NAME = "ApiUnhandledErrorCount";
const WORKER_UNEXPECTED_ERROR_METRIC_NAME = "WorkerUnexpectedErrorCount";
const AI_PROVIDER_FAILURE_METRIC_NAME = "AiProviderFailureCount";
const AI_PROVIDER_FAILURE_FILTERS = [
  {
    failureCodes: [
      "ai_authentication_failed",
      "ai_network_error",
      "ai_rate_limited",
      "ai_service_unavailable",
      "ai_timeout",
    ],
    filterName: "finhand-prod-document-ai-provider-failures",
    id: "DocumentAiProviderFailureMetricFilter",
    processingEvent: "document.processing.completed",
  },
  {
    failureCodes: [
      "transcription_authentication_failed",
      "transcription_network_error",
      "transcription_rate_limited",
      "transcription_service_unavailable",
      "transcription_timeout",
    ],
    filterName: "finhand-prod-transcription-ai-provider-failures",
    id: "TranscriptionAiProviderFailureMetricFilter",
    processingEvent: "audio.processing.completed",
  },
  {
    failureCodes: [
      "audio_candidate_extraction_authentication_failed",
      "audio_candidate_extraction_network_error",
      "audio_candidate_extraction_rate_limited",
      "audio_candidate_extraction_service_unavailable",
      "audio_candidate_extraction_timeout",
    ],
    filterName: "finhand-prod-audio-extraction-ai-provider-failures",
    id: "AudioExtractionAiProviderFailureMetricFilter",
    processingEvent: "audio.processing.completed",
  },
] as const;
const WORKER_UNEXPECTED_ERROR_EVENTS = [
  "audio.processing.recovery.failed",
  "audio.worker.iteration.failed",
  "document.capture.cleanup.failed",
  "document.processing.recovery.failed",
  "document.worker.iteration.failed",
] as const;

function readProductionDeploymentFile(fileName: string): string {
  const candidates = [
    resolve(process.cwd(), "deploy/production", fileName),
    resolve(process.cwd(), "../../deploy/production", fileName),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error(`Could not find production deployment file: ${fileName}`);
  }

  return readFileSync(filePath, "utf8");
}

export class ProductionStack extends Stack {
  public constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    if (this.region !== PRODUCTION_REGION) {
      throw new Error(
        `FinHand production must be synthesized for ${PRODUCTION_REGION}; received ${this.region}.`,
      );
    }

    Tags.of(this).add("Application", "finhand");
    Tags.of(this).add("Environment", "production");
    Tags.of(this).add("ManagedBy", "aws-cdk");

    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      vpcName: "finhand-prod-vpc",
    });

    const hostSecurityGroup = new ec2.SecurityGroup(
      this,
      "HostSecurityGroup",
      {
        allowAllOutbound: false,
        description:
          "Public HTTP and HTTPS access for the FinHand production proxy",
        securityGroupName: "finhand-prod-host-sg",
        vpc,
      },
    );
    hostSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Public HTTP for certificate issuance and HTTPS redirects",
    );
    hostSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Public HTTPS for the Caddy reverse proxy",
    );
    hostSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS for AWS APIs, image pulls, OAuth, OpenAI, and updates",
    );

    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `finhand-prod-uploads-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Tags.of(uploadsBucket).add("DataClassification", "financial-private");

    const backupBucket = new s3.Bucket(this, "BackupBucket", {
      bucketName: `finhand-prod-backups-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [
        {
          expiration: Duration.days(30),
          id: "ExpireDatabaseBackups",
          noncurrentVersionExpiration: Duration.days(7),
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
    });
    Tags.of(backupBucket).add("DataClassification", "financial-private");

    const webRepository = this.createApplicationRepository(
      "WebRepository",
      "finhand-prod-web-ecr",
    );
    const apiRepository = this.createApplicationRepository(
      "ApiRepository",
      "finhand-prod-api-ecr",
    );
    const containerLogGroupsByName = new Map<string, logs.LogGroup>();
    for (const { id, name } of PRODUCTION_CONTAINER_LOG_GROUPS) {
      containerLogGroupsByName.set(
        name,
        new logs.LogGroup(this, id, {
          logGroupName: name,
          removalPolicy: RemovalPolicy.RETAIN,
          retention: logs.RetentionDays.ONE_MONTH,
        }),
      );
    }
    const containerLogGroups = Array.from(containerLogGroupsByName.values());
    const apiLogGroup = containerLogGroupsByName.get(
      "/finhand/production/api",
    );
    const workerLogGroup = containerLogGroupsByName.get(
      "/finhand/production/worker",
    );

    if (!apiLogGroup || !workerLogGroup) {
      throw new Error("Required production application log groups are missing.");
    }

    new logs.MetricFilter(this, "ApiUnhandledErrorMetricFilter", {
      filterName: "finhand-prod-api-unhandled-errors",
      filterPattern: logs.FilterPattern.stringValue(
        "$.event",
        "=",
        "http.request.failed",
      ),
      logGroup: apiLogGroup,
      metricName: API_UNHANDLED_ERROR_METRIC_NAME,
      metricNamespace: FINHAND_METRICS_NAMESPACE,
      metricValue: "1",
      unit: cloudwatch.Unit.COUNT,
    });
    new logs.MetricFilter(this, "WorkerUnexpectedErrorMetricFilter", {
      filterName: "finhand-prod-worker-unexpected-errors",
      filterPattern: logs.FilterPattern.any(
        ...WORKER_UNEXPECTED_ERROR_EVENTS.map((event) =>
          logs.FilterPattern.stringValue("$.event", "=", event),
        ),
      ),
      logGroup: workerLogGroup,
      metricName: WORKER_UNEXPECTED_ERROR_METRIC_NAME,
      metricNamespace: FINHAND_METRICS_NAMESPACE,
      metricValue: "1",
      unit: cloudwatch.Unit.COUNT,
    });
    for (const {
      failureCodes,
      filterName,
      id,
      processingEvent,
    } of AI_PROVIDER_FAILURE_FILTERS) {
      new logs.MetricFilter(this, id, {
        filterName,
        filterPattern: logs.FilterPattern.all(
          logs.FilterPattern.stringValue(
            "$.event",
            "=",
            processingEvent,
          ),
          logs.FilterPattern.stringValue("$.status", "=", "failed"),
          logs.FilterPattern.any(
            ...failureCodes.map((failureCode) =>
              logs.FilterPattern.stringValue(
                "$.failureCode",
                "=",
                failureCode,
              ),
            ),
          ),
        ),
        logGroup: workerLogGroup,
        metricName: AI_PROVIDER_FAILURE_METRIC_NAME,
        metricNamespace: FINHAND_METRICS_NAMESPACE,
        metricValue: "1",
        unit: cloudwatch.Unit.COUNT,
      });
    }

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description:
        "Least-privilege runtime role for the FinHand production EC2 host",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
      ],
      roleName: "finhand-prod-instance-role",
    });
    webRepository.grantPull(instanceRole);
    apiRepository.grantPull(instanceRole);
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ContainerLogWrite",
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: containerLogGroups.map(
          (logGroup) => `${logGroup.logGroupArn}:*`,
        ),
      }),
    );
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ProductionMetricWrite",
        actions: ["cloudwatch:PutMetricData"],
        conditions: {
          StringEquals: {
            "cloudwatch:namespace": FINHAND_METRICS_NAMESPACE,
          },
        },
        resources: ["*"],
      }),
    );
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "UploadObjectAccess",
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ],
        resources: [uploadsBucket.arnForObjects("*")],
      }),
    );
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DatabaseBackupAccess",
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [backupBucket.arnForObjects("database/*")],
      }),
    );
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "RuntimeParameterRead",
        actions: ["ssm:GetParametersByPath"],
        resources: [
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "parameter",
            resourceName: runtimeParameterRoot.slice(1),
          }),
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "parameter",
            resourceName: `${runtimeParameterRoot.slice(1)}/*`,
          }),
        ],
      }),
    );

    const productionHostAmiId = ssm.StringParameter.valueForStringParameter(
      this,
      PRODUCTION_HOST_AMI_PARAMETER_NAME,
      PRODUCTION_HOST_AMI_PARAMETER_VERSION,
    );
    const host = new ec2.Instance(this, "Host", {
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(16, {
            deleteOnTermination: true,
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
          }),
        },
      ],
      detailedMonitoring: false,
      httpEndpoint: true,
      httpPutResponseHopLimit: 2,
      httpTokens: ec2.HttpTokens.REQUIRED,
      instanceMetadataTags: false,
      instanceName: "finhand-prod-host",
      instanceType: new ec2.InstanceType("t4g.small"),
      machineImage: ec2.MachineImage.genericLinux({
        [PRODUCTION_REGION]: productionHostAmiId,
      }),
      propagateTagsToVolumeOnCreation: true,
      role: instanceRole,
      securityGroup: hostSecurityGroup,
      vpc,
      vpcSubnets: { subnets: [vpc.publicSubnets[0]] },
    });
    new CfnOutput(this, "HostAmiSelection", {
      description: "Version-pinned Parameter Store selection for the host AMI",
      value: `${PRODUCTION_HOST_AMI_PARAMETER_NAME}:${PRODUCTION_HOST_AMI_PARAMETER_VERSION}`,
    });
    const alertEmail = ssm.StringParameter.valueForStringParameter(
      this,
      PRODUCTION_ALERT_EMAIL_PARAMETER_NAME,
    );
    const productionObservability = createProductionObservability(this, {
      alertEmail,
      hostInstanceId: host.instanceId,
    });

    const databaseVolume = new ec2.Volume(this, "DatabaseVolume", {
      availabilityZone: vpc.publicSubnets[0].availabilityZone,
      encrypted: true,
      size: Size.gibibytes(20),
      volumeName: "finhand-prod-database",
      volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
    });
    databaseVolume.applyRemovalPolicy(RemovalPolicy.RETAIN);
    Tags.of(databaseVolume).add("DataClassification", "financial-private");

    const databaseVolumeAttachment = new ec2.CfnVolumeAttachment(
      this,
      "DatabaseVolumeAttachment",
      {
        device: "/dev/sdf",
        instanceId: host.instanceId,
        volumeId: databaseVolume.volumeId,
      },
    );

    const hostBootstrapDocument = new ssm.CfnDocument(
      this,
      "HostBootstrapDocument",
      {
        content: createHostBootstrapDocumentContent(),
        documentFormat: "JSON",
        documentType: "Command",
        name: "finhand-prod-bootstrap-host",
        targetType: "/AWS::EC2::Instance",
        updateMethod: "NewVersion",
      },
    );

    const hostBootstrapAssociation = new ssm.CfnAssociation(
      this,
      "HostBootstrapAssociation",
      {
        associationName: "finhand-prod-bootstrap-host",
        complianceSeverity: "HIGH",
        documentVersion: "$LATEST",
        maxConcurrency: "1",
        maxErrors: "0",
        name: hostBootstrapDocument.ref,
        parameters: {
          BootstrapRevision: [HOST_BOOTSTRAP_REVISION],
          DatabaseVolumeId: [databaseVolume.volumeId],
        },
        syncCompliance: "AUTO",
        targets: [
          {
            key: "InstanceIds",
            values: [host.instanceId],
          },
        ],
        waitForSuccessTimeoutSeconds: 900,
      },
    );
    hostBootstrapAssociation.addResourceDependency(databaseVolumeAttachment);

    const runtimeConfigurationDocument = new ssm.CfnDocument(
      this,
      "RuntimeConfigurationDocument",
      {
        content: createRuntimeConfigurationDocumentContent({
          accountId: this.account,
          region: this.region,
          uploadsBucketName: uploadsBucket.bucketName,
        }),
        documentFormat: "JSON",
        documentType: "Command",
        name: "finhand-prod-render-runtime-config",
        targetType: "/AWS::EC2::Instance",
        updateMethod: "NewVersion",
      },
    );

    const applicationDeploymentDocument = new ssm.CfnDocument(
      this,
      "ApplicationDeploymentDocument",
      {
        content: createApplicationDeploymentDocumentContent({
          accountId: this.account,
          backupBucketName: backupBucket.bucketName,
          caddyConfiguration: readProductionDeploymentFile("Caddyfile"),
          composeConfiguration:
            readProductionDeploymentFile("compose.yaml"),
          region: this.region,
        }),
        documentFormat: "JSON",
        documentType: "Command",
        name: "finhand-prod-deploy-application",
        targetType: "/AWS::EC2::Instance",
        updateMethod: "NewVersion",
      },
    );

    const githubActionsProvider = new iam.OidcProviderNative(
      this,
      "GithubActionsProvider",
      {
        clientIds: ["sts.amazonaws.com"],
        url: "https://token.actions.githubusercontent.com",
      },
    );
    const githubDeploymentRole = new iam.Role(
      this,
      "GithubDeploymentRole",
      {
        assumedBy: new iam.OpenIdConnectPrincipal(githubActionsProvider, {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": GITHUB_ACTIONS_SUBJECT,
          },
        }),
        description:
          "Least-privilege GitHub Actions role for approved FinHand production releases",
        maxSessionDuration: Duration.hours(1),
        roleName: "finhand-prod-github-deploy-role",
      },
    );
    webRepository.grantPush(githubDeploymentRole);
    webRepository.grantRead(githubDeploymentRole);
    apiRepository.grantPush(githubDeploymentRole);
    apiRepository.grantRead(githubDeploymentRole);
    githubDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DeploymentImageParameters",
        actions: ["ssm:GetParameter", "ssm:PutParameter"],
        resources: [
          "deployment/web-image",
          "deployment/api-image",
        ].map((parameterName) =>
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "parameter",
            resourceName: `${runtimeParameterRoot.slice(1)}/${parameterName}`,
          }),
        ),
      }),
    );
    githubDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ApprovedProductionCommands",
        actions: ["ssm:SendCommand"],
        resources: [
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "document",
            resourceName: runtimeConfigurationDocument.ref,
          }),
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "document",
            resourceName: applicationDeploymentDocument.ref,
          }),
          this.formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ec2",
            resource: "instance",
            resourceName: host.instanceId,
          }),
        ],
      }),
    );
    githubDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ProductionCommandStatus",
        actions: ["ssm:ListCommandInvocations"],
        resources: ["*"],
      }),
    );

    const elasticIp = new ec2.CfnEIP(this, "ElasticIp", {
      domain: "vpc",
    });
    Tags.of(elasticIp).add("Name", "finhand-prod-eip");

    new ec2.CfnEIPAssociation(this, "ElasticIpAssociation", {
      allocationId: elasticIp.attrAllocationId,
      instanceId: host.instanceId,
    });

    new CfnOutput(this, "Architecture", {
      description: "Approved production deployment model",
      value: "single-ec2-docker-compose",
    });

    new CfnOutput(this, "VpcId", {
      description: "Production VPC ID",
      value: vpc.vpcId,
    });

    new CfnOutput(this, "PublicSubnetId", {
      description: "Public subnet ID for the production EC2 host",
      value: vpc.publicSubnets[0].subnetId,
    });

    new CfnOutput(this, "HostSecurityGroupId", {
      description: "Security group ID for the production EC2 host",
      value: hostSecurityGroup.securityGroupId,
    });

    new CfnOutput(this, "UploadsBucketName", {
      description: "Private bucket for production document and audio uploads",
      value: uploadsBucket.bucketName,
    });

    new CfnOutput(this, "BackupBucketName", {
      description: "Private retained bucket for production database backups",
      value: backupBucket.bucketName,
    });

    new CfnOutput(this, "WebRepositoryUri", {
      description: "ECR repository URI for the production web image",
      value: webRepository.repositoryUri,
    });

    new CfnOutput(this, "ApiRepositoryUri", {
      description: "ECR repository URI shared by the production API and worker",
      value: apiRepository.repositoryUri,
    });

    new CfnOutput(this, "InstanceRoleName", {
      description: "Least-privilege role for the production EC2 host",
      value: instanceRole.roleName,
    });

    new CfnOutput(this, "GithubDeploymentRoleArn", {
      description:
        "GitHub OIDC role for manually approved production deployments",
      value: githubDeploymentRole.roleArn,
    });

    new CfnOutput(this, "HostInstanceId", {
      description: "Production EC2 host instance ID",
      value: host.instanceId,
    });

    new CfnOutput(this, "ProductionAlertTopicArn", {
      description: "SNS topic that receives production alarm notifications",
      value: productionObservability.alertTopic.topicArn,
    });

    new CfnOutput(this, "ProductionDashboardName", {
      description: "CloudWatch dashboard for production health and failures",
      value: productionObservability.dashboard.dashboardName,
    });

    new CfnOutput(this, "HostPublicIp", {
      description: "Stable public IPv4 address for the production EC2 host",
      value: elasticIp.attrPublicIp,
    });

    new CfnOutput(this, "DatabaseVolumeId", {
      description: "Retained encrypted PostgreSQL data volume ID",
      value: databaseVolume.volumeId,
    });

    new CfnOutput(this, "HostBootstrapDocumentName", {
      description: "Systems Manager document that prepares the production host",
      value: hostBootstrapDocument.ref,
    });

    new CfnOutput(this, "HostBootstrapAssociationId", {
      description: "State Manager association that applies the host bootstrap",
      value: hostBootstrapAssociation.attrAssociationId,
    });

    new CfnOutput(this, "RuntimeConfigurationDocumentName", {
      description:
        "Systems Manager document that renders protected runtime environment files",
      value: runtimeConfigurationDocument.ref,
    });

    new CfnOutput(this, "ApplicationDeploymentDocumentName", {
      description:
        "Systems Manager document that deploys the production application",
      value: applicationDeploymentDocument.ref,
    });
  }

  private createApplicationRepository(
    id: string,
    repositoryName: string,
  ): ecr.Repository {
    return new ecr.Repository(this, id, {
      repositoryName,
      encryption: ecr.RepositoryEncryption.AES_256,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
