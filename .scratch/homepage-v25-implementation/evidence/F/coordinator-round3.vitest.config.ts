import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: [".scratch/homepage-v25-implementation/evidence/F/coordinator-round2.test.ts", ".scratch/homepage-v25-implementation/evidence/F/coordinator-round3.test.ts", ".scratch/homepage-v25-implementation/evidence/F/coordinator-round3-boundaries.test.ts"], maxWorkers: 1 } });
