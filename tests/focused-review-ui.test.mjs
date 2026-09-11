import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ships the focused stock review interface", () => {
  const workspace = source("app/components/trade-review-workspace.tsx");
  const chart = source("app/components/review/review-chart-workspace.tsx");
  const library = source("app/components/library/trade-library.tsx");
  const queue = source("app/components/library/review-queue.tsx");

  assert.match(workspace, /focusedExecutions/);
  assert.match(workspace, /专注图表/);
  assert.match(chart, /focusRange/);
  assert.match(library, /进入逐笔复盘/);
  assert.match(queue, /回合复盘队列/);
});
