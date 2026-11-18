import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ProductionStack } from "../lib/production-stack.js";

const productionEnvironment = {
  account: "123456789012",
  region: "us-east-1",
};

describe("ProductionStack", () => {
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
