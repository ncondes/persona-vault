import { defineConfig } from "vitest/config";

// Node environment on purpose: these tests cover the app's logic, not its
// rendering. The pure functions were pulled out of the components into
// `src/lib` precisely so they could be checked without a DOM.
export default defineConfig({
  // Resolves the `@/*` alias straight from tsconfig.json — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
      reporter: ["text-summary", "text", "lcov"],
      // Floors, a few points under what the suite reaches today. `useLoad.ts` is
      // the one thing left at zero — it is a React hook and needs a renderer,
      // which is out of scope here on purpose.
      thresholds: { statements: 85, branches: 90, functions: 88, lines: 85 },
    },
  },
});
