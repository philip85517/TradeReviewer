import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", maxWorkers: 1, cache: false, include: [".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/accepted-round1-interface-trace.test.ts", ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/accepted-round1-ipo-fee-contract.test.ts"] } });
