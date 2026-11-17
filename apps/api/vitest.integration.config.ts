import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globalSetup: ["./test/integration/global-setup.ts"],
    include: ["test/**/*.integration.test.ts"],
    maxWorkers: 1,
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});
