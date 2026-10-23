import { startVitest } from "vitest/node";

const target = ".scratch/homepage-v25-implementation/evidence/P2/chart/independent-review/mixed-input.counterexample.test.tsx";
// Only this evidence test is collected; the repository configuration is read, never edited.
const context = await startVitest("test", [target], { run: true, watch: false, maxWorkers: 1 }, {
  test: { include: [target] },
});
const failed = context.state.getCountOfFailedTests();
const errors = context.state.getUnhandledErrors().length;
await context.close();
process.exitCode = failed || errors ? 1 : 0;
