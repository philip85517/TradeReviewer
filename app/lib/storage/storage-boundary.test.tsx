import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StatementParseResult } from "../import/contracts";
import type { EnrichedImportResult } from "../import/enrich-import";
import type { DemoReplayFrame } from "../demo/replay-frame";
import type { SqliteHttpClient } from "./sqlite-http-client";
import type { TradeExecution } from "../trades/types";
import { TradeReviewWorkspace } from "../../components/trade-review-workspace";

const { mockDispatcher, mockEnrichment, mockMarketDataSync } = vi.hoisted(
  () => ({
    mockDispatcher: vi.fn(),
    mockEnrichment: vi.fn(),
    mockMarketDataSync: vi.fn(),
  }),
);

vi.mock("../import/dispatcher", () => ({
  parseBrokerStatement: mockDispatcher,
}));

vi.mock("../import/enrich-import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../import/enrich-import")>()),
  enrichStatementImport: mockEnrichment,
}));

vi.mock("../market/sync-service", () => ({
  syncMarketData: mockMarketDataSync,
}));

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

const importedExecution: TradeExecution = {
  id: "boundary:trade:1",
  source: { platform: "china-merchants", page: 1, row: 1 },
  accountId: "boundary-account",
  accountLabel: "边界测试账户",
  instrument: {
    id: "CN-SH:600938",
    symbol: "600938",
    name: "中国海油",
    market: "CN-SH",
    currency: "CNY",
  },
  side: "buy",
  executedAt: "2026-01-02T02:00:00.000Z",
  quantity: "100",
  price: "15.20",
  fee: "5",
};

const importParseResult: StatementParseResult = {
  broker: "china-merchants",
  records: [importedExecution],
  candidates: [{ market: "CN-SH", symbol: "600938", sourceAssetType: "stock" }],
  exclusions: [],
  diagnostics: [],
  blocked: false,
};

const enrichedImport: EnrichedImportResult = {
  broker: "china-merchants",
  importable: [importedExecution],
  unresolved: [],
  exclusions: [],
  diagnostics: [],
  cacheHits: 0,
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

function importStatements(source: string) {
  const statements: string[] = [];
  const starts = source.matchAll(/^import\b/gm);
  for (const startMatch of starts) {
    const start = startMatch.index;
    if (start === undefined) continue;
    const end = source.indexOf(";", start);
    if (end === -1) throw new Error(`Unterminated import statement at offset ${start}`);
    statements.push(source.slice(start, end + 1));
  }
  return statements;
}

function allowsPureImportLibraryImport(statement: string) {
  if (!statement.includes("import-library")) return true;
  if (/^import\s+type\b/.test(statement)) return true;
  const named = statement.match(/import\s*\{([\s\S]*?)\}\s*from\s*["'][^"']*import-library["'];/);
  if (!named) return false;
  return named[1]
    .split(",")
    .map((specifier) => specifier.trim().split(/\s+as\s+/)[0])
    .filter(Boolean)
    .every((specifier) => specifier === "mergeExecutions");
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
    putSuggestionDecision: vi.fn().mockResolvedValue({}),
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
    mockDispatcher.mockReset();
    mockEnrichment.mockReset();
    mockMarketDataSync.mockReset();
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

  it("persists an imported trade and chart settings through SQLite without legacy browser writes", async () => {
    const user = userEvent.setup();
    const client = emptySqliteClient();
    const writeLegacyStorage = vi.spyOn(Storage.prototype, "setItem");
    const indexedDbOpen = vi.fn();
    vi.stubGlobal("indexedDB", { open: indexedDbOpen });
    mockDispatcher.mockResolvedValue(importParseResult);
    mockEnrichment.mockResolvedValue(enrichedImport);
    mockMarketDataSync.mockResolvedValue({
      source: "cache",
      status: "complete",
      candles: [],
      requestedRanges: [],
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={client}
        legacyStateExporter={async () => null}
      />,
    );

    await user.upload(
      await screen.findByLabelText("导入交易记录"),
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "boundary.pdf", {
        type: "application/pdf",
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "确认导入并开始更新行情" }),
    );
    await waitFor(() => {
      expect(client.mergeExecutions).toHaveBeenCalledWith(
        expect.objectContaining({
          executions: [importedExecution],
          importHistory: [expect.objectContaining({ fileName: "boundary.pdf" })],
        }),
      );
    });

    await user.click(await screen.findByRole("tab", { name: "复盘笔记" }));
    await user.type(
      await screen.findByLabelText("心理复盘"),
      "边界测试复盘记录",
    );
    await waitFor(() => {
      expect(client.putReview).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentId: importedExecution.instrument.id,
          review: expect.objectContaining({ psychology: "边界测试复盘记录" }),
        }),
      );
    });

    await user.click(await screen.findByRole("button", { name: "图表设置" }));
    await user.click(screen.getByRole("checkbox", { name: "显示成交量" }));
    await waitFor(() => {
      expect(client.putSettings).toHaveBeenCalledWith(
        expect.objectContaining({ showVolume: false }),
      );
    });

    expect(writeLegacyStorage).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
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
      .join("|");
    const legacyRuntimeImport = new RegExp(
      `^import(?!\\s+type\\b)\\s+[^;]*?from\\s+["'][^"']*(?:${legacyModules})["']`,
      "m",
    );
    for (const path of productionSourceFiles(join(root, "app"))) {
      const relative = path.slice(root.length + 1);
      if (relative === "app/lib/storage/browser-state-export.ts" || legacyStoragePaths.some((file) => relative === `app/lib/storage/${file}`)) continue;
      const statements = importStatements(readFileSync(path, "utf8"));
      const importLibraryStatements = statements.filter((item) => item.includes("import-library"));
      const otherRuntimeImports = statements.filter((item) => !item.includes("import-library"));
      expect(otherRuntimeImports.join("\n"), relative).not.toMatch(legacyRuntimeImport);
      for (const statement of importLibraryStatements) {
        expect(allowsPureImportLibraryImport(statement), `${relative}: ${statement}`).toBe(true);
      }
    }

    expect(allowsPureImportLibraryImport(
      'import { mergeExecutions } from "./import-library";',
    )).toBe(true);
    expect(allowsPureImportLibraryImport(
      'import { saveImportedExecutions } from "./import-library";',
    )).toBe(false);

    const forbiddenBeforeImportLibrary = [
      'import { saveChartSettings } from "./chart-settings";',
      'import { mergeExecutions } from "./import-library";',
    ].join("\n");
    const fixtureImports = importStatements(forbiddenBeforeImportLibrary);
    expect(
      fixtureImports
        .filter((statement) => !statement.includes("import-library"))
        .join("\n"),
    ).toMatch(legacyRuntimeImport);
  });
});
