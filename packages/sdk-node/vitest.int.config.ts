import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "sdk-node:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
