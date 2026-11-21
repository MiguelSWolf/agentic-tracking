import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "sdk-browser:integration",
    include: ["src/**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
