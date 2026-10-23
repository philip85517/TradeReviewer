import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", maxWorkers: 1, cache: false,
    setupFiles: ["./tests/setup.ts"],
    include: [".scratch/homepage-v25-implementation/evidence/P3/frozen-direct-trades.test.tsx"],
  },
});
