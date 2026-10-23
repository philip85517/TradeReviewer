import { defineConfig } from "vitest/config";
export default defineConfig({ resolve: { alias: { "server-only": new URL("../../../../../tests/server-only.ts", import.meta.url).pathname } }, test: { environment: "node", maxWorkers: 1, cache: false, include: [".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/isolated-single-projection.test.ts"] } });
