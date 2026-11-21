import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "projector:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
