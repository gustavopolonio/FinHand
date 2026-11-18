import {
  CfnOutput,
  Stack,
  Tags,
  Validations,
  type StackProps,
} from "aws-cdk-lib";
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

    Validations.of(this).acknowledge({
      id: "CloudFormation-Validate::F0001",
      reason:
        "The foundation stack intentionally defines no AWS resources until the first resource change is reviewed.",
    });

    new CfnOutput(this, "Architecture", {
      description: "Approved production deployment model",
      value: "single-ec2-docker-compose",
    });
  }
}
