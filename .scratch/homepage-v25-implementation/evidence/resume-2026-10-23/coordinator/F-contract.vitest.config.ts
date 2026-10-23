import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: [".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-contract.test.ts"], maxWorkers: 1 } });
