import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  HOST_BOOTSTRAP_REVISION,
  HOST_BOOTSTRAP_SCRIPT,
} from "../lib/host-bootstrap.js";
import { ProductionStack } from "../lib/production-stack.js";

const productionEnvironment = {
  account: "123456789012",
  region: "us-east-1",
};

describe("ProductionStack", () => {
  it("creates a single-subnet public VPC without paid network gateways", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::EC2::VPC", {
      CidrBlock: "10.0.0.0/16",
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      Tags: Match.arrayWith([
        { Key: "Name", Value: "finhand-prod-vpc" },
      ]),
    });
    template.resourceCountIs("AWS::EC2::Subnet", 1);
    template.hasResourceProperties("AWS::EC2::Subnet", {
      MapPublicIpOnLaunch: true,
      Tags: Match.arrayWith([
        { Key: "aws-cdk:subnet-name", Value: "public" },
        { Key: "aws-cdk:subnet-type", Value: "Public" },
      ]),
    });
    template.resourceCountIs("AWS::EC2::InternetGateway", 1);
    template.resourceCountIs("AWS::EC2::VPCGatewayAttachment", 1);
    template.hasResourceProperties("AWS::EC2::Route", {
      DestinationCidrBlock: "0.0.0.0/0",
      GatewayId: Match.anyValue(),
    });
    template.resourceCountIs("AWS::EC2::NatGateway", 0);
  });

  it("exposes only HTTP and HTTPS inbound to the future host", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      GroupDescription:
        "Public HTTP and HTTPS access for the FinHand production proxy",
      GroupName: "finhand-prod-host-sg",
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({
          CidrIp: "0.0.0.0/0",
          FromPort: 443,
          IpProtocol: "tcp",
          ToPort: 443,
        }),
      ]),
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          CidrIp: "0.0.0.0/0",
          FromPort: 80,
          IpProtocol: "tcp",
          ToPort: 80,
        }),
        Match.objectLike({
          CidrIp: "0.0.0.0/0",
          FromPort: 443,
          IpProtocol: "tcp",
          ToPort: 443,
        }),
      ]),
    });

    const securityGroups = template.findResources("AWS::EC2::SecurityGroup");
    expect(Object.keys(securityGroups)).toHaveLength(1);
    const [securityGroup] = Object.values(securityGroups);
    const ingressRules = securityGroup.Properties.SecurityGroupIngress as Array<{
      FromPort: number;
      ToPort: number;
    }>;
    const egressRules = securityGroup.Properties.SecurityGroupEgress as unknown[];

    expect(ingressRules).toHaveLength(2);
    expect(egressRules).toHaveLength(1);
    expect(ingressRules).not.toContainEqual(
      expect.objectContaining({ FromPort: 22, ToPort: 22 }),
    );
  });

  it("creates a private retained uploads bucket", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256",
            },
          },
        ],
      },
      BucketName: "finhand-prod-uploads-123456789012",
      OwnershipControls: {
        Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      Tags: Match.arrayWith([
        { Key: "Application", Value: "finhand" },
        { Key: "DataClassification", Value: "financial-private" },
        { Key: "Environment", Value: "production" },
        { Key: "ManagedBy", Value: "aws-cdk" },
      ]),
    });
    template.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:*",
            Condition: {
              Bool: { "aws:SecureTransport": "false" },
            },
            Effect: "Deny",
            Principal: { AWS: "*" },
          }),
        ]),
      },
    });
  });

  it("creates a private retained database-backup bucket with bounded retention", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: "finhand-prod-backups-123456789012",
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            ExpirationInDays: 30,
            Id: "ExpireDatabaseBackups",
            NoncurrentVersionExpiration: { NoncurrentDays: 7 },
            Status: "Enabled",
          }),
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      VersioningConfiguration: { Status: "Enabled" },
    });
  });

  it("creates immutable retained repositories for the web and API images", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::ECR::Repository", 2);

    for (const repositoryName of [
      "finhand-prod-web-ecr",
      "finhand-prod-api-ecr",
    ]) {
      template.hasResourceProperties("AWS::ECR::Repository", {
        ImageScanningConfiguration: { ScanOnPush: true },
        ImageTagMutability: "IMMUTABLE",
        RepositoryName: repositoryName,
      });
    }

    const repositories = template.findResources("AWS::ECR::Repository");
    for (const repository of Object.values(repositories)) {
      expect(repository).toMatchObject({
        DeletionPolicy: "Retain",
        UpdateReplacePolicy: "Retain",
      });
      // CloudFormation defaults ECR repositories to AES-256 when this
      // property is omitted, avoiding the recurring cost of a KMS key.
      expect(repository.Properties).not.toHaveProperty(
        "EncryptionConfiguration",
      );
    }
  });

  it("creates a least-privilege role for the production EC2 host", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::IAM::Role", 1);
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
          },
        ],
        Version: "2012-10-17",
      },
      Description:
        "Least-privilege runtime role for the FinHand production EC2 host",
      ManagedPolicyArns: [
        {
          "Fn::Join": [
            "",
            [
              "arn:",
              { Ref: "AWS::Partition" },
              ":iam::aws:policy/AmazonSSMManagedInstanceCore",
            ],
          ],
        },
      ],
      RoleName: "finhand-prod-instance-role",
    });

    template.resourceCountIs("AWS::IAM::Policy", 1);
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: Match.stringLikeRegexp("InstanceRoleDefaultPolicy"),
    });

    const policies = template.findResources("AWS::IAM::Policy");
    const [policy] = Object.values(policies);
    const statements = policy.Properties.PolicyDocument.Statement as Array<{
      Action: string | string[];
      Resource: unknown;
      Sid?: string;
    }>;

    expect(statements).toHaveLength(6);
    expect(statements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Action: "ecr:GetAuthorizationToken",
          Effect: "Allow",
          Resource: "*",
        }),
        expect.objectContaining({
          Action: [
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
          ],
          Effect: "Allow",
          Resource: {
            "Fn::GetAtt": [expect.stringMatching(/^WebRepository/), "Arn"],
          },
        }),
        expect.objectContaining({
          Action: [
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
          ],
          Effect: "Allow",
          Resource: {
            "Fn::GetAtt": [expect.stringMatching(/^ApiRepository/), "Arn"],
          },
        }),
        expect.objectContaining({
          Action: expect.arrayContaining([
            "s3:AbortMultipartUpload",
            "s3:DeleteObject",
            "s3:GetObject",
            "s3:ListMultipartUploadParts",
            "s3:PutObject",
          ]),
          Effect: "Allow",
          Resource: expect.objectContaining({
            "Fn::Join": expect.any(Array),
          }),
          Sid: "UploadObjectAccess",
        }),
        expect.objectContaining({
          Action: ["s3:PutObject", "s3:GetObject"],
          Effect: "Allow",
          Resource: expect.objectContaining({
            "Fn::Join": expect.any(Array),
          }),
          Sid: "DatabaseBackupAccess",
        }),
        expect.objectContaining({
          Action: "ssm:GetParametersByPath",
          Effect: "Allow",
          Resource: expect.arrayContaining([
            expect.objectContaining({
              "Fn::Join": expect.any(Array),
            }),
            expect.objectContaining({
              "Fn::Join": expect.any(Array),
            }),
          ]),
          Sid: "RuntimeParameterRead",
        }),
      ]),
    );
    const actions = statements.flatMap((statement) =>
      Array.isArray(statement.Action) ? statement.Action : [statement.Action],
    );
    expect(actions).not.toContain("*");
    expect(
      statements.filter((statement) => statement.Resource === "*"),
    ).toEqual([
      expect.objectContaining({ Action: "ecr:GetAuthorizationToken" }),
    ]);
    const runtimeParameterStatement = statements.find(
      (statement) => statement.Sid === "RuntimeParameterRead",
    );
    const runtimeParameterResources = JSON.stringify(
      runtimeParameterStatement?.Resource,
    );
    expect(runtimeParameterResources).toContain(
      ":parameter/finhand/production\"",
    );
    expect(runtimeParameterResources).toContain(
      ":parameter/finhand/production/*",
    );
  });

  it("creates a hardened ARM host with separate retained database storage", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::EC2::Instance", 1);
    template.hasResourceProperties("AWS::EC2::Instance", {
      BlockDeviceMappings: [
        {
          DeviceName: "/dev/xvda",
          Ebs: {
            DeleteOnTermination: true,
            Encrypted: true,
            VolumeSize: 16,
            VolumeType: "gp3",
          },
        },
      ],
      InstanceType: "t4g.small",
      ImageId: "ami-00b0d691a87846f99",
      MetadataOptions: {
        HttpEndpoint: "enabled",
        HttpPutResponseHopLimit: 2,
        HttpTokens: "required",
        InstanceMetadataTags: "disabled",
      },
      PropagateTagsToVolumeOnCreation: true,
      Tags: Match.arrayWith([
        { Key: "Name", Value: "finhand-prod-host" },
      ]),
    });

    const instances = template.findResources("AWS::EC2::Instance");
    const [instance] = Object.values(instances);
    expect(instance.Properties).not.toHaveProperty("KeyName");
    expect(instance.Properties.Monitoring).not.toBe(true);

    template.resourceCountIs("AWS::IAM::InstanceProfile", 1);
    template.hasResourceProperties("AWS::IAM::InstanceProfile", {
      Roles: [{ Ref: Match.stringLikeRegexp("InstanceRole") }],
    });

    template.resourceCountIs("AWS::EC2::Volume", 1);
    template.hasResourceProperties("AWS::EC2::Volume", {
      Encrypted: true,
      Size: 20,
      Tags: Match.arrayWith([
        { Key: "DataClassification", Value: "financial-private" },
        { Key: "Name", Value: "finhand-prod-database" },
      ]),
      VolumeType: "gp3",
    });
    template.hasResource("AWS::EC2::Volume", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    const volumes = template.findResources("AWS::EC2::Volume");
    const [databaseVolume] = Object.values(volumes);
    expect(databaseVolume.Properties.AvailabilityZone).toEqual(
      instance.Properties.AvailabilityZone,
    );
    template.hasResourceProperties("AWS::EC2::VolumeAttachment", {
      Device: "/dev/sdf",
      InstanceId: { Ref: Match.stringLikeRegexp("Host") },
      VolumeId: { Ref: Match.stringLikeRegexp("DatabaseVolume") },
    });

    const parameters = Object.values(template.toJSON().Parameters ?? {}) as Array<{
      Type?: string;
    }>;
    expect(parameters).not.toContainEqual(
      expect.objectContaining({
        Type: "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>",
      }),
    );
  });

  it("prepares the host through an idempotent Systems Manager association", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::SSM::Document", 3);
    template.hasResourceProperties("AWS::SSM::Document", {
      DocumentFormat: "JSON",
      DocumentType: "Command",
      Name: "finhand-prod-bootstrap-host",
      TargetType: "/AWS::EC2::Instance",
      UpdateMethod: "NewVersion",
      Content: {
        schemaVersion: "2.2",
        parameters: {
          BootstrapRevision: Match.objectLike({ type: "String" }),
          DatabaseVolumeId: Match.objectLike({
            allowedPattern: "^vol-[0-9a-f]+$",
            type: "String",
          }),
        },
        mainSteps: [
          Match.objectLike({
            action: "aws:runShellScript",
            name: "bootstrapHost",
            inputs: {
              runCommand: [HOST_BOOTSTRAP_SCRIPT],
              timeoutSeconds: "900",
            },
          }),
        ],
      },
    });

    template.resourceCountIs("AWS::SSM::Association", 1);
    template.hasResourceProperties("AWS::SSM::Association", {
      AssociationName: "finhand-prod-bootstrap-host",
      ComplianceSeverity: "HIGH",
      DocumentVersion: "$LATEST",
      MaxConcurrency: "1",
      MaxErrors: "0",
      Name: { Ref: Match.stringLikeRegexp("HostBootstrapDocument") },
      Parameters: {
        BootstrapRevision: [HOST_BOOTSTRAP_REVISION],
        DatabaseVolumeId: [
          { Ref: Match.stringLikeRegexp("DatabaseVolume") },
        ],
      },
      SyncCompliance: "AUTO",
      Targets: [
        {
          Key: "InstanceIds",
          Values: [{ Ref: Match.stringLikeRegexp("Host") }],
        },
      ],
      WaitForSuccessTimeoutSeconds: 900,
    });

    const associations = template.findResources("AWS::SSM::Association");
    const [association] = Object.values(associations);
    expect(association.DependsOn).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^DatabaseVolumeAttachment/),
      ]),
    );
  });

  it("creates a manual runtime-configuration rendering document", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::SSM::Document", {
      DocumentFormat: "JSON",
      DocumentType: "Command",
      Name: "finhand-prod-render-runtime-config",
      TargetType: "/AWS::EC2::Instance",
      UpdateMethod: "NewVersion",
      Content: {
        schemaVersion: "2.2",
        mainSteps: [
          Match.objectLike({
            action: "aws:runShellScript",
            name: "renderRuntimeConfiguration",
            inputs: {
              runCommand: [Match.anyValue()],
              timeoutSeconds: "180",
            },
          }),
        ],
      },
    });

    template.resourceCountIs("AWS::SSM::Association", 1);
  });

  it("creates a manual application deployment document", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::SSM::Document", {
      DocumentFormat: "JSON",
      DocumentType: "Command",
      Name: "finhand-prod-deploy-application",
      TargetType: "/AWS::EC2::Instance",
      UpdateMethod: "NewVersion",
      Content: {
        schemaVersion: "2.2",
        mainSteps: [
          Match.objectLike({
            action: "aws:runShellScript",
            name: "deployApplication",
            inputs: {
              runCommand: [Match.anyValue()],
              timeoutSeconds: "900",
            },
          }),
        ],
      },
    });
  });

  it("keeps destructive host setup behind explicit safety checks", () => {
    const syntaxCheck = spawnSync("bash", ["-n"], {
      encoding: "utf8",
      input: HOST_BOOTSTRAP_SCRIPT,
    });

    expect(syntaxCheck.stderr).toBe("");
    expect(syntaxCheck.status).toBe(0);
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'filesystem_type=$(blkid --match-tag TYPE --output value "$device"',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'if [[ -z "$filesystem_type" ]]; then',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'signatures=$(wipefs --no-act --noheadings --output TYPE "$device"',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'mkfs.ext4 -L finhand-postgres "$device"',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'printf \'UUID=%s %s ext4 defaults,nofail 0 2\\n\'',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).not.toContain("mkfs.ext4 -F");
  });

  it("pins and verifies Compose and configures bounded host resources", () => {
    expect(HOST_BOOTSTRAP_REVISION).toMatch(/^[0-9a-f]{16}$/);
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      "dnf install -y docker e2fsprogs jq",
    );
    expect(HOST_BOOTSTRAP_SCRIPT).not.toContain("dnf install -y curl");
    expect(HOST_BOOTSTRAP_SCRIPT).toContain('COMPOSE_VERSION="v5.7.1"');
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'COMPOSE_SHA256="f2f49f903240895fa764c0dca3a14548b754ad9426f6b609ccaf55ec5a3aa2a5"',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain("sha256sum --check");
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      '{"max-size": "10m", "max-file": "3"}',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      'fallocate --length 1G "$SWAP_FILE"',
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      "printf 'vm.swappiness = 10\\n'",
    );
    expect(HOST_BOOTSTRAP_SCRIPT).toContain(
      "install -d -o root -g root -m 0700 /opt/finhand/config",
    );
  });

  it("creates and associates one stable public IPv4 address", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::EC2::EIP", 1);
    template.hasResourceProperties("AWS::EC2::EIP", {
      Domain: "vpc",
      Tags: Match.arrayWith([{ Key: "Name", Value: "finhand-prod-eip" }]),
    });
    template.resourceCountIs("AWS::EC2::EIPAssociation", 1);
    template.hasResourceProperties("AWS::EC2::EIPAssociation", {
      AllocationId: Match.anyValue(),
      InstanceId: { Ref: Match.stringLikeRegexp("Host") },
    });
  });

  it("exposes the deployment outputs", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);
    template.hasOutput("Architecture", {
      Description: "Approved production deployment model",
      Value: "single-ec2-docker-compose",
    });
    template.hasOutput("VpcId", {
      Description: "Production VPC ID",
      Value: Match.anyValue(),
    });
    template.hasOutput("PublicSubnetId", {
      Description: "Public subnet ID for the production EC2 host",
      Value: Match.anyValue(),
    });
    template.hasOutput("HostSecurityGroupId", {
      Description: "Security group ID for the production EC2 host",
      Value: Match.anyValue(),
    });
    template.hasOutput("UploadsBucketName", {
      Description: "Private bucket for production document and audio uploads",
      Value: Match.anyValue(),
    });
    template.hasOutput("BackupBucketName", {
      Description: "Private retained bucket for production database backups",
      Value: Match.anyValue(),
    });
    template.hasOutput("WebRepositoryUri", {
      Description: "ECR repository URI for the production web image",
      Value: Match.anyValue(),
    });
    template.hasOutput("ApiRepositoryUri", {
      Description: "ECR repository URI shared by the production API and worker",
      Value: Match.anyValue(),
    });
    template.hasOutput("InstanceRoleName", {
      Description: "Least-privilege role for the production EC2 host",
      Value: Match.anyValue(),
    });
    template.hasOutput("HostInstanceId", {
      Description: "Production EC2 host instance ID",
      Value: Match.anyValue(),
    });
    template.hasOutput("HostPublicIp", {
      Description: "Stable public IPv4 address for the production EC2 host",
      Value: Match.anyValue(),
    });
    template.hasOutput("DatabaseVolumeId", {
      Description: "Retained encrypted PostgreSQL data volume ID",
      Value: Match.anyValue(),
    });
    template.hasOutput("HostBootstrapDocumentName", {
      Description: "Systems Manager document that prepares the production host",
      Value: Match.anyValue(),
    });
    template.hasOutput("HostBootstrapAssociationId", {
      Description: "State Manager association that applies the host bootstrap",
      Value: Match.anyValue(),
    });
    template.hasOutput("RuntimeConfigurationDocumentName", {
      Description:
        "Systems Manager document that renders protected runtime environment files",
      Value: Match.anyValue(),
    });
    template.hasOutput("ApplicationDeploymentDocumentName", {
      Description:
        "Systems Manager document that deploys the production application",
      Value: Match.anyValue(),
    });
  });

  it("rejects synthesis in a region other than us-east-1", () => {
    const app = new App();

    expect(
      () =>
        new ProductionStack(app, "WrongRegionStack", {
          env: {
            ...productionEnvironment,
            region: "sa-east-1",
          },
        }),
    ).toThrow(
      "FinHand production must be synthesized for us-east-1; received sa-east-1.",
    );
  });
});
