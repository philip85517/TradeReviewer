import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoReplayFrame } from "../demo/replay-frame";
import type { SqliteHttpClient } from "./sqlite-http-client";
import { TradeReviewWorkspace } from "../../components/trade-review-workspace";

const root = process.cwd();
const workspacePath = join(root, "app/components/trade-review-workspace.tsx");
const exporterPath = join(root, "app/lib/storage/browser-state-export.ts");
const legacyStoragePaths = [
  "chart-settings.ts",
  "import-history.ts",
  "import-library.ts",
  "import-transaction.ts",
  "market-data-jobs.ts",
  "review-storage.ts",
  "indexeddb-schema.ts",
  "indexeddb-episode-review-repository.ts",
  "indexeddb-instrument-metadata-repository.ts",
  "indexeddb-market-data-repository.ts",
  "indexeddb-suggestion-decision.ts",
  "indexeddb-tag-suggestion-repository.ts",
];

const initialFrame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2026-01-01T00:00:00.000Z",
  candles15m: [],
  executions: [],
  canGoBack: false,
  canGoForward: false,
};

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test-support" ? [] : productionSourceFiles(path);
    }
    return /(?<!\.test)\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function emptySqliteClient(): SqliteHttpClient {
  return {
    getStatus: vi.fn(),
    getBootstrap: vi.fn().mockResolvedValue({
      schemaVersion: 1,
      migration: null,
      executions: [],
      importHistory: [],
      instruments: [],
      reviews: [],
      reviewStates: [],
      tagSuggestions: [],
      marketDataJobs: [],
      settings: {
        version: 1,
        showGrid: true,
        showVolume: true,
        showExecutions: true,
        showAverageCost: true,
        colorScheme: "teal-red",
      },
    }),
    migrate: vi.fn().mockResolvedValue({}),
    mergeExecutions: vi.fn().mockResolvedValue({}),
    putReview: vi.fn().mockResolvedValue({}),
    putReviewState: vi.fn().mockResolvedValue({}),
    putTagSuggestion: vi.fn().mockResolvedValue({}),
    getProviderSymbol: vi.fn().mockResolvedValue(undefined),
    getMarketData: vi.fn().mockResolvedValue({ candles: [], intervalCoverage: [] }),
    putMarketData: vi.fn().mockResolvedValue({ ok: true }),
    putMarketDataJob: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({}),
    putSettings: vi.fn().mockResolvedValue({}),
  } as SqliteHttpClient;
}

describe("SQLite production storage boundary", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the import-empty state from an empty SQLite bootstrap without legacy reads", async () => {
    const client = emptySqliteClient();
    const readLegacyStorage = vi.spyOn(Storage.prototype, "getItem");

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={client}
        legacyStateExporter={async () => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("暂无导入股票，请先导入交易记录。")).toBeInTheDocument();
    });
    expect(client.getBootstrap).toHaveBeenCalledOnce();
    expect(readLegacyStorage).not.toHaveBeenCalled();
  });

  it("routes import and review persistence through SQLite APIs rather than legacy writes", () => {
    const workspace = readFileSync(workspacePath, "utf8");

    expect(workspace).toContain("storageClient.mergeExecutions(");
    expect(workspace).toContain("storageClient.putReviewState(");
    expect(workspace).toContain("reviewRepository.put(record)");
    expect(workspace).toContain("storageClient.putSettings(next)");
    expect(workspace).not.toMatch(/\b(?:load|save)ImportedExecutions\b/);
    expect(workspace).not.toMatch(/\b(?:load|save)ImportHistory\b/);
    expect(workspace).not.toMatch(/\b(?:load|save)ChartSettings\b/);
    expect(workspace).not.toMatch(/\b(?:IndexedDb|localStorage|indexedDB)\b/);
  });

  it("marks legacy browser stores as migration-only and limits the exporter boundary", () => {
    const exporter = readFileSync(exporterPath, "utf8");
    expect(exporter).toContain("MIGRATION-ONLY");

    for (const file of legacyStoragePaths) {
      const source = readFileSync(join(root, "app/lib/storage", file), "utf8");
      expect(source, file).toContain("MIGRATION-ONLY");
    }

    const legacyModules = legacyStoragePaths
      .map((file) => file.replace(/\.ts$/, ""))
      .filter((file) => file !== "import-library")
      .join("|");
    const legacyRuntimeImport = new RegExp(
      `^import(?!\\s+type\\b)\\s+[^;]*?from\\s+["'][^"']*(?:${legacyModules})["']`,
      "m",
    );
    for (const path of productionSourceFiles(join(root, "app"))) {
      const relative = path.slice(root.length + 1);
      if (relative === "app/lib/storage/browser-state-export.ts" || legacyStoragePaths.some((file) => relative === `app/lib/storage/${file}`)) continue;
      expect(readFileSync(path, "utf8"), relative).not.toMatch(legacyRuntimeImport);
    }
  });
});
