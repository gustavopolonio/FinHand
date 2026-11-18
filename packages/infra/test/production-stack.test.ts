import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ProductionStack } from "../lib/production-stack.js";

const productionEnvironment = {
  account: "123456789012",
  region: "us-east-1",
};

describe("ProductionStack", () => {
  it("synthesizes the approved architecture marker without resources", () => {
    const app = new App();
    const stack = new ProductionStack(app, "TestProductionStack", {
      env: productionEnvironment,
    });

    const template = Template.fromStack(stack);

    const synthesizedTemplate = template.toJSON();

    expect(synthesizedTemplate).toMatchObject({
      Outputs: {
        Architecture: {
          Description: "Approved production deployment model",
          Value: "single-ec2-docker-compose",
        },
      },
    });
    expect(synthesizedTemplate.Resources).toBeUndefined();
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
