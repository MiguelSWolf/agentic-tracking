import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "event-bus",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
