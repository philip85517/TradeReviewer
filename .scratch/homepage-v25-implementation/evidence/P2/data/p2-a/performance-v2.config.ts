import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", cache: false, maxWorkers: 1, include: [".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/performance-v2.test.ts"] } });
