import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "event-store:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
