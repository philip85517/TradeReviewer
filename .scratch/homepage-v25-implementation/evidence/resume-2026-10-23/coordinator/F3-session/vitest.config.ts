import { defineConfig } from "vitest/config";
export default defineConfig({test:{environment:"node",maxWorkers:1,cache:false,include:[
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/root-session-green.test.ts",
  "app/lib/reviews/homepage-v25-performance.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/F-acceptance-2-interface-trace.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/F-acceptance-2-ipo-fee-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/invariant-red.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/F-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/coordinator-round3-boundaries.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/peer.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/F-current-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/session-cutoff.test.ts",
  "app/lib/replay/position-ledger.test.ts",
  "app/lib/trades/episodes.test.ts",
  "app/lib/trades/library.test.ts",
  "app/lib/reviews/trading-room-scope.test.ts",
  "app/lib/import/statement-evidence.test.ts",
  "app/lib/market/sync-range.test.ts",
  "app/lib/market/calendar.test.ts",
  "app/lib/market/trading-date.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/holdings-model.test.ts"
]}});
