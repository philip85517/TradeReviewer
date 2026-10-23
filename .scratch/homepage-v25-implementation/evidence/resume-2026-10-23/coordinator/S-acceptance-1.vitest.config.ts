import { defineConfig } from "vitest/config";
import base from "../../../../../vitest.config";
export default defineConfig({ ...base, test: { ...base.test, include: [
  "app/lib/reviews/homepage-v25-state.test.ts",
  "app/lib/reviews/dashboard-browse-preferences.test.ts",
  "app/components/library/library-browse-state.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/S-contract.test.ts",
], maxWorkers: 1 } });
