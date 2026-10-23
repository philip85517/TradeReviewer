import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("../../../../../", import.meta.url).pathname } },
  test: {
    environment: "jsdom", maxWorkers: 1, cache: false,
    setupFiles: ["./tests/setup.ts"],
    include: [
      ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/frozen-old-peer.test.tsx",
      ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/owned-read-recheck.test.tsx",
    ],
  },
});
