import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "collector:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
