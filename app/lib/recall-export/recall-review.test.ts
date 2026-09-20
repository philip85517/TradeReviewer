import { describe, expect, it } from "vitest";

import type { NormalizedDrawing } from "../chart/drawings";
import type { RecallDocument, RecallSnapshot } from "../recall/types";
import type { TradeEpisode } from "../trades/types";
import {
  buildRecallMarkdown,
  createRecallExportManifest,
  writeRecallExportDirectory,
  type RecallDirectoryHandle,
} from "./index";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function drawing(id: string, text: string, revision: number, owner?: string): NormalizedDrawing {
  return {
    version: 2,
    id,
    episodeId: "unknown-episode",
    name: "text",
    tool: "text",
    anchors: [{ time: "2026-01-01T00:00:00.000Z", price: 10 }],
    style: { color: "#fff", lineWidth: 1, opacity: 1 },
    text,
    zIndex: 0,
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    createdAtCursor: "2026-01-01T00:00:00.000Z",
    ...(owner === undefined ? {} : { recallOwnerId: owner }),
    textRevision: revision,
  };
}

function snapshot(id: string, decisionId: RecallSnapshot["decisionId"], drawings: NormalizedDrawing[] = []): RecallSnapshot {
  return {
    id,
    decisionId,
    timeframe: "1D",
    cursor: "2026-01-01T00:00:00.000Z",
    executionCursor: "2026-01-01T00:00:00.000Z",
    candles: [],
    drawings,
    imageDataUrl: PNG,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function documentFor(
  snapshots: RecallSnapshot[],
  status: RecallDocument["status"] = "in-progress",
): RecallDocument {
  return {
    version: 1,
    episodeId: "unknown-episode",
    revision: 1,
    decisions: [{ id: "decision-1", executionIds: ["execution-1"] }],
    snapshots,
    working: {
      drawings: [],
      timeframe: "1D",
      cursor: "2026-01-01T00:00:00.000Z",
      executionCursor: "2026-01-01T00:00:00.000Z",
      selectedDecisionId: "decision-1",
    },
    status,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function episodeFor(
  market: string,
  sourceTimezone: string,
): TradeEpisode {
  return {
    id: "unknown-episode",
    accountId: "account",
    accountLabel: "Account",
    instrument: {
      id: `${market}:SY/M`,
      symbol: "SY/M",
      name: "Name/With:Illegal.",
      market,
      currency: "USD",
    },
    direction: "long",
    status: "closed",
    startedAt: "2026-01-01T23:30:00.000Z",
    endedAt: "2026-01-02T00:30:00.000Z",
    openingQuantity: "1",
    remainingQuantity: "0",
    executions: [{
      id: "execution-1",
      source: { platform: "review", row: 1, sourceTimezone },
      accountId: "account",
      accountLabel: "Account",
      instrument: {
        id: `${market}:SY/M`,
        symbol: "SY/M",
        name: "Name/With:Illegal.",
        market,
        currency: "USD",
      },
      side: "buy",
      executedAt: "2026-01-01T23:30:00.000Z",
      quantity: "1",
      price: "10",
      fee: "0",
    }],
  };
}

describe("independent Recall export review", () => {
  it("uses the recorded source timezone for an unknown market date", () => {
    const episode = episodeFor("UNKNOWN", "Asia/Shanghai");
    const manifest = createRecallExportManifest(
      documentFor([snapshot("s1", "decision-1")]),
      episode,
      { generatedAt: "2026-01-03T00:00:00.000Z" },
    );

    expect(manifest.folderName).toBe("Name_With_Illegal_SY_M_20260102");
    expect(manifest.markdownName).toBe("Name_With_Illegal_SY_M_20260102_复盘.md");
  });

  it("keeps stable identity distinct from equal text and preserves requested order", () => {
    const episode = episodeFor("US", "America/New_York");
    const document = documentFor([
      snapshot("s1", "decision-1", [
        drawing("same-a", "same", 1, "decision-1"),
        drawing("same-b", "same", 1, "decision-1"),
      ]),
      snapshot("s2", "decision-1", [
        drawing("same-a", "same", 1, "decision-1"),
        drawing("same-a", "changed", 2, "decision-1"),
      ]),
      snapshot("global", "global", [drawing("summary", "summary", 1, "global")]),
    ], "completed");
    const manifest = createRecallExportManifest(document, episode, {
      generatedAt: "2026-01-03T00:00:00.000Z",
      order: {
        snapshotIds: ["s2", "s1", "global"],
        textIdsBySnapshot: {
          s1: ["same-b\u00001\u0000decision-1", "same-a\u00001\u0000decision-1"],
          s2: ["same-a\u00002\u0000decision-1", "same-a\u00001\u0000decision-1"],
          global: ["summary\u00001\u0000global"],
        },
      },
    });

    expect(manifest.snapshots.map((item) => item.id)).toEqual(["s2", "s1", "global"]);
    expect(manifest.textEntries.map((entry) => entry.key)).toEqual([
      "same-a\u00002\u0000decision-1",
      "same-a\u00001\u0000decision-1",
      "same-b\u00001\u0000decision-1",
      "summary\u00001\u0000global",
    ]);
    const markdown = buildRecallMarkdown(manifest);
    expect(markdown.indexOf("changed")).toBeLessThan(markdown.indexOf("same"));
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.snapshots[0].textIds)).toBe(true);
  });

  it("warns when an unretained decision draft has excluded drawings", () => {
    const episode = episodeFor("US", "America/New_York");
    const document = documentFor([snapshot("global", "global")]);
    document.working.decisionDrafts = [{
      mode: "decision",
      decisionId: "decision-1",
      drawings: [drawing("draft", "stage draft", 1, "decision-1")],
      timeframe: "1D",
      cursor: "2026-01-01T00:00:00.000Z",
      executionCursor: "execution-1",
    }];

    const manifest = createRecallExportManifest(document, episode, {
      generatedAt: "2026-01-03T00:00:00.000Z",
    });

    expect(manifest.warnings).toContainEqual(expect.objectContaining({ code: "working-content-excluded" }));
  });
});

class AbortDuringMarkdownDirectory implements RecallDirectoryHandle {
  readonly dirs = new Map<string, AbortDuringMarkdownDirectory>();
  readonly files = new Map<string, Uint8Array>();

  constructor(readonly name?: string, private readonly abortName?: string) {}

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
    const existing = this.dirs.get(name);
    if (existing) return existing;
    if (!options.create) {
      const error = new Error("missing");
      Object.assign(error, { name: "NotFoundError" });
      throw error;
    }
    const child = new AbortDuringMarkdownDirectory(name, this.abortName);
    this.dirs.set(name, child);
    return child;
  }

  async getFileHandle(name: string) {
    return {
      createWritable: async () => ({
        write: async (value: Blob) => {
          if (this.abortName === name) {
            const error = new Error("interrupted");
            Object.assign(error, { name: "AbortError" });
            throw error;
          }
          this.files.set(name, new Uint8Array(await value.arrayBuffer()));
        },
        close: async () => undefined,
      }),
    };
  }
}

it("reports an interrupted write as partial and leaves the unique directory intact", async () => {
  const episode = episodeFor("US", "America/New_York");
  const manifest = createRecallExportManifest(
    documentFor([snapshot("s1", "decision-1")], "completed"),
    episode,
    { generatedAt: "2026-01-03T00:00:00.000Z" },
  );
  const root = new AbortDuringMarkdownDirectory("exports", manifest.markdownName);
  const existing = new AbortDuringMarkdownDirectory(manifest.folderName);
  existing.files.set("sentinel.txt", new Uint8Array([1, 2, 3]));
  root.dirs.set(manifest.folderName, existing);
  const result = await writeRecallExportDirectory(manifest, root);

  expect(result.status).toBe("partial");
  expect(result.writtenFiles).toBe(1);
  expect(result.displayPath).toContain(manifest.folderName);
  expect(result.folderName).toBe(`${manifest.folderName}_02`);
  expect(existing.files.get("sentinel.txt")).toEqual(new Uint8Array([1, 2, 3]));
});
