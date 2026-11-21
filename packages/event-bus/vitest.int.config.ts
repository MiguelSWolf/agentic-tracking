import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "event-bus:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
