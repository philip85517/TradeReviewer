import { homepageTestSnapshot } from "../lib/storage/homepage-source-fixture.test-support";
import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import { encodeHomepageSourceBinding, type HomepageStoredCollection } from "../lib/storage/homepage-source-contract";

const evaluated = vi.hoisted(() => new Set<string>());
vi.mock("../lib/import/dispatcher", async (original) => {
  evaluated.add("dispatcher");
  return original();
});
vi.mock("./library/trade-library", async (original) => {
  evaluated.add("TradeLibrary");
  return original();
});
vi.mock("./recall/recall-workspace", async (original) => {
  evaluated.add("RecallWorkspace");
  return original();
});
vi.mock("./review/review-chart-workspace", async (original) => {
  evaluated.add("ReviewChartWorkspace");
  return original();
});
vi.mock("./dashboard/review-dashboard", async (original) => {
  evaluated.add("ReviewDashboard");
  return original();
});
vi.mock("xlsx", async (original) => {
  evaluated.add("xlsx");
  return original();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("defers import parsing and XLSX while preserving eager workspace views on the production homepage", async () => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/home");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ aliases: [] })));
  const initialFrame: DemoReplayFrame = {
    cursorIndex: 0,
    cursor: "2025-01-02T14:30:00.000Z",
    candles15m: [],
    executions: [],
    canGoBack: false,
    canGoForward: false,
  };
  const client = createLegacySqliteClient();
  client.getHomepageSource = async () => {
    const bootstrap = await client.getBootstrap();
    const stored: HomepageStoredCollection = {
      bootstrap, ...homepageTestSnapshot(bootstrap), recallSummaries: [], receipt: {
        policy: "homepage-stored-collection-v1", scope: "all-persisted-records", enumeration: "complete",
        receiptId: "isolated-startup-fixture", knownAt: new Date().toISOString(),
        counts: { executions: 0, instruments: 0, importHistory: 0, legacyReviewRows: 0, recallDocuments: 0 },
        projectionGaps: [], payloadDigest: "",
      },
    };
    return {
      ...stored,
      receipt: {
        ...stored.receipt,
        payloadDigest: `sha256:${createHash("sha256").update(encodeHomepageSourceBinding(stored)).digest("hex")}`,
      },
    };
  };
  render(<TradeReviewWorkspace initialFrame={initialFrame} showDemo={false}
    storageClient={client} legacyStateExporter={async () => null} />);
  await screen.findByLabelText("主导航", { selector: "aside" });
  await screen.findByText("当前范围暂无持仓");
  expect(evaluated.has("dispatcher")).toBe(false);
  expect(evaluated.has("xlsx")).toBe(false);
  expect([...evaluated].sort()).toEqual([
    "RecallWorkspace", "ReviewChartWorkspace", "ReviewDashboard", "TradeLibrary",
  ]);
});
