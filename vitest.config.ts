import { defineConfig } from "vitest/config";

/**
 * One run over every workspace, each with its own environment and setup.
 *
 * Coverage is measured here rather than per workspace, so CI uploads a single
 * report; codecov.yml splits it back into core and web by path.
 */
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    coverage: {
      include: ["{packages,apps}/*/src/**"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "packages/core/src/data.generated.ts",
      ],
      reporter: ["lcov", "text-summary"],
    },
  },
});
