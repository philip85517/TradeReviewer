import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", maxWorkers: 1, cache: false, include: [
  "app/lib/reviews/homepage-v25-performance.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-acceptance-2-interface-trace.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-acceptance-2-ipo-fee-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-debug/invariant-red.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/F/coordinator-round3-boundaries.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-peer-review/peer.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-current-contract.test.ts",
  "app/lib/replay/position-ledger.test.ts",
  "app/lib/trades/episodes.test.ts",
  "app/lib/trades/library.test.ts",
  "app/lib/reviews/trading-room-scope.test.ts",
  "app/lib/import/statement-evidence.test.ts",
] } });
