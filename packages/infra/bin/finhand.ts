#!/usr/bin/env node

import { App } from "aws-cdk-lib";
import { ProductionStack } from "../lib/production-stack.js";

const app = new App();

new ProductionStack(app, "FinHandProduction", {
  description: "FinHand single-host production infrastructure",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  stackName: "finhand-production",
});
