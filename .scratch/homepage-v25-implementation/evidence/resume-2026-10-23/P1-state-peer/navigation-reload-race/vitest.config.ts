import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": process.cwd(), "server-only": path.join(process.cwd(), "tests/server-only.ts") } },
  test: { environment: "jsdom", maxWorkers: 1, cache: false, setupFiles: ["./tests/setup.ts"],
    include: [".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer/navigation-reload-race/navigation-reload-race.test.tsx"] },
});
