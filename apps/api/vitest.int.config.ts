import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
