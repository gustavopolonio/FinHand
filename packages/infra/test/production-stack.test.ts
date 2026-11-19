import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
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
    template.resourceCountIs("AWS::EC2::EIP", 0);
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
    template.hasOutput("WebRepositoryUri", {
      Description: "ECR repository URI for the production web image",
      Value: Match.anyValue(),
    });
    template.hasOutput("ApiRepositoryUri", {
      Description: "ECR repository URI shared by the production API and worker",
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
