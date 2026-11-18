import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

const PRODUCTION_REGION = "us-east-1";

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

    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `finhand-prod-uploads-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Tags.of(uploadsBucket).add("DataClassification", "financial-private");

    const webRepository = this.createApplicationRepository(
      "WebRepository",
      "finhand-prod-web-ecr",
    );
    const apiRepository = this.createApplicationRepository(
      "ApiRepository",
      "finhand-prod-api-ecr",
    );

    new CfnOutput(this, "Architecture", {
      description: "Approved production deployment model",
      value: "single-ec2-docker-compose",
    });

    new CfnOutput(this, "UploadsBucketName", {
      description: "Private bucket for production document and audio uploads",
      value: uploadsBucket.bucketName,
    });

    new CfnOutput(this, "WebRepositoryUri", {
      description: "ECR repository URI for the production web image",
      value: webRepository.repositoryUri,
    });

    new CfnOutput(this, "ApiRepositoryUri", {
      description: "ECR repository URI shared by the production API and worker",
      value: apiRepository.repositoryUri,
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
