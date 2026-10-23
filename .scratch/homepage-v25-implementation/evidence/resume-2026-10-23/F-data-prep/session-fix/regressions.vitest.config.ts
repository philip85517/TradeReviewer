import { defineConfig } from "vitest/config";
export default defineConfig({test:{environment:"node",maxWorkers:1,cache:false,include:[
  "app/lib/reviews/homepage-v25-performance.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/F-acceptance-2-interface-trace.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/F-acceptance-2-ipo-fee-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/invariant-red.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/F-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/coordinator-round3-boundaries.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/peer.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/F-current-contract.test.ts",
  ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/session-cutoff.test.ts",
  "app/lib/replay/position-ledger.test.ts",
  "app/lib/trades/episodes.test.ts",
  "app/lib/trades/library.test.ts",
  "app/lib/reviews/trading-room-scope.test.ts",
  "app/lib/import/statement-evidence.test.ts",
  "app/lib/market/sync-range.test.ts",
  "app/lib/market/calendar.test.ts",
  "app/lib/market/trading-date.test.ts",
  "app/components/homepage-v25/holdings-model.test.ts"
]}});
