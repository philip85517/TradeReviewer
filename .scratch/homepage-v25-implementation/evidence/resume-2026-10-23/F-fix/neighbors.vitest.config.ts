import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", maxWorkers: 1, cache: false, include: [
  "app/lib/replay/position-ledger.test.ts",
  "app/lib/trades/episodes.test.ts",
  "app/lib/trades/library.test.ts",
  "app/lib/reviews/trading-room-scope.test.ts",
  "app/lib/import/statement-evidence.test.ts",
] } });
