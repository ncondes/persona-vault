import { defineConfig } from "vitest/config";

// The three demos carry the same OAuth plumbing on purpose — each is meant to be
// a complete example you can lift whole. Only this one is tested; `parity.test.ts`
// checks the other two copies have not drifted from it, which is what makes
// testing one of them enough.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/**/route.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text-summary", "text"],
      // The plumbing is fully covered, so the floor is set at 100. It is a small
      // surface and it is the security-critical part of a relying party.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
