import { defineConfig } from "vitest/config";
export default defineConfig({
 resolve: { alias: { "@": "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/", "server-only": "/Users/zhoulin/.codex/worktrees/0dc6/TradeReview/tests/server-only.ts" } },
 test: { environment:"jsdom", maxWorkers:1, cache:false, setupFiles:["./tests/setup.ts"], include:[".scratch/homepage-v25-implementation/evidence/P1/F-nature-diagnosis/f-nature.test.tsx"] }
});
