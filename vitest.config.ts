import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./tests/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "jsdom",
    // Bound jsdom UI and child-process test contention on shared resources.
    maxWorkers: 2,
    setupFiles: ["./tests/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "db/**/*.test.ts", "scripts/**/*.test.mjs"],
    // These operational integration tests use Node's native test runner.
    // Run them with `make deploy-test` alongside the Vitest regression suite.
    exclude: [
      ...configDefaults.exclude,
      "scripts/deploy-source.test.mjs",
      "scripts/deploy-native-runtime.test.mjs",
      "scripts/deploy-native-toolkit.test.mjs",
      "scripts/deploy-native.test.mjs",
      "scripts/deploy-native-safety.test.mjs",
      "scripts/native-environment.test.mjs",
      "scripts/debug-local.test.mjs",
    ],
  },
});
