import { describe, expect, it } from "vitest";

import type { NormalizedDrawing } from "../chart/drawings";
import type { RecallDocument, RecallSnapshot } from "../recall/types";
import type { TradeEpisode } from "../trades/types";
import type { RecallExportManifest } from "./types";
import {
  buildRecallMarkdown,
  buildRecallZip,
  createRecallExportManifest,
  writeRecallExportDirectory,
  type RecallDirectoryHandle,
} from "./index";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const episode: TradeEpisode = {
  id: "episode-1",
  accountId: "acct-1",
  accountLabel: "演示账户",
  instrument: { id: "US:A/B", symbol: "A/B", name: "示例股", market: "US", currency: "USD" },
  direction: "long",
  status: "closed",
  startedAt: "2026-01-02T04:30:00.000Z",
  endedAt: "2026-01-03T04:30:00.000Z",
  openingQuantity: "10",
  remainingQuantity: "0",
  executions: [
    {
      id: "exec-1",
      source: { platform: "test", row: 1 },
      accountId: "acct-1",
      accountLabel: "演示账户",
      instrument: { id: "US:A/B", symbol: "A/B", name: "示例股", market: "US", currency: "USD" },
      side: "buy",
      executedAt: "2026-01-02T04:30:00.000Z",
      quantity: "10",
      price: "10.00",
      fee: "0.10",
    },
  ],
};

function drawing(id: string, text: string, revision: number, owner?: string): NormalizedDrawing {
  return {
    version: 2,
    id,
    episodeId: episode.id,
    name: "text",
    tool: "text",
    anchors: [{ time: "2026-01-02T04:30:00.000Z", price: 10 }],
    style: { color: "#fff", lineWidth: 1, opacity: 1 },
    text,
    zIndex: 1,
    hidden: true,
    locked: false,
    visibleOn: "all",
    stage: "post-review",
    createdAtCursor: "2026-01-02T04:30:00.000Z",
    recallOwnerId: owner,
    textRevision: revision,
  };
}

function snapshot(
  id: string,
  decisionId: RecallSnapshot["decisionId"],
  drawings: NormalizedDrawing[],
  overrides: Partial<RecallSnapshot> = {},
): RecallSnapshot {
  return {
    id,
    decisionId,
    timeframe: "1D",
    cursor: "2026-01-02T04:30:00.000Z",
    executionCursor: "2026-01-02T04:30:00.000Z",
    candles: [],
    drawings,
    imageDataUrl: PNG,
    createdAt: "2026-01-02T04:30:00.000Z",
    updatedAt: "2026-01-02T04:30:00.000Z",
    ...overrides,
  };
}

function withoutSnapshotField(
  value: RecallSnapshot,
  field: "phase" | "cursor" | "executionCursor",
) {
  const copy = { ...value } as Partial<RecallSnapshot>;
  delete copy[field];
  return copy as RecallSnapshot;
}

function documentWith(snapshots: RecallSnapshot[], status: RecallDocument["status"] = "in-progress"): RecallDocument {
  return {
    version: 1,
    episodeId: episode.id,
    revision: 1,
    decisions: [{ id: "decision-1", executionIds: ["exec-1"] }, { id: "decision-2", executionIds: [] }],
    snapshots,
    working: {
      drawings: [drawing("working", "do not export", 99, "decision-1")],
      timeframe: "1D",
      cursor: "2026-01-02T04:30:00.000Z",
      executionCursor: "2026-01-02T04:30:00.000Z",
      selectedDecisionId: "decision-1",
    },
    status,
    updatedAt: "2026-01-02T04:30:00.000Z",
  };
}

describe("recall export manifest", () => {
  it("freezes retained content, excludes working drawings, and warns about incomplete state", () => {
    const document = documentWith([
      snapshot("s1", "decision-1", [drawing("d1", "same", 1, "decision-1"), drawing("d2", "same", 1, "decision-1")]),
      snapshot("s2", "decision-1", [drawing("d1", "same", 1, "decision-1"), drawing("d1", "modified", 2, "decision-2")]),
    ]);
    const manifest = createRecallExportManifest(document, episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(manifest.files.every((file) => Object.isFrozen(file.bytes))).toBe(true);
    expect(manifest.textEntries.map((entry) => entry.text)).toEqual(["same", "same", "modified"]);
    expect(manifest.textEntries.some((entry) => entry.text === "do not export")).toBe(false);
    expect(manifest.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      "no-global-snapshot",
      "missing-snapshot",
      "unfinished",
      "working-content-excluded",
    ]));
  });

  it("warns when a decision overlay has unretained working content", () => {
    const base = documentWith([
      snapshot("s1", "decision-1", []),
      snapshot("g1", "global", []),
    ]);
    const document: RecallDocument = {
      ...base,
      working: {
        ...base.working,
        drawings: [],
        editingContext: {
          mode: "decision",
          decisionId: "decision-1",
          drawings: [drawing("overlay", "draft overlay", 1, "decision-1")],
          timeframe: "1D",
          cursor: "2026-01-02T04:30:00.000Z",
          executionCursor: "exec-1",
        },
      },
    };

    const manifest = createRecallExportManifest(document, episode, { generatedAt: "2026-01-04T00:00:00.000Z" });

    expect(manifest.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "working-content-excluded" }),
    ]));
  });

  it("uses the exchange date in names and emits offline relative image links", () => {
    const document = documentWith([
      snapshot("s1", "decision-1", [drawing("d1", "offscreen", 1, "decision-1")]),
      snapshot("g1", "global", []),
    ], "completed");
    const manifest = createRecallExportManifest(document, episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    expect(manifest.folderName).toBe("示例股_A_B_20260101");
    expect(manifest.markdownName).toBe("示例股_A_B_20260101_复盘.md");
    expect(manifest.files.map((file) => file.path)).toEqual([
      "images/01_01_1D.png",
      "images/global.png",
      "示例股_A_B_20260101_复盘.md",
    ]);
    const markdown = buildRecallMarkdown(manifest);
    expect(markdown).toContain("![1D](images/01_01_1D.png)");
    expect(markdown).toContain("offscreen");
    expect(markdown).not.toContain("http://");
    expect(markdown).toContain("2026-01-01");
  });

  it("honors a complete preview order and creates a UTF-8 stored ZIP", () => {
    const document = documentWith([
      snapshot("s1", "decision-1", [drawing("d1", "one", 1, "decision-1"), drawing("d2", "two", 1, "decision-1")]),
      snapshot("s2", "decision-1", [drawing("d3", "three", 1, "decision-1")]),
    ], "completed");
    const manifest = createRecallExportManifest(document, episode, {
      order: {
        snapshotIds: ["s2", "s1"],
        textIdsBySnapshot: {
          s1: ["d2\u00001\u0000decision-1", "d1\u00001\u0000decision-1"],
          s2: ["d3\u00001\u0000decision-1"],
        },
      },
      generatedAt: "2026-01-04T00:00:00.000Z",
    });
    expect(manifest.snapshots.map((snapshot) => snapshot.id)).toEqual(["s2", "s1"]);
    expect(manifest.snapshots[1].textIds[0]).toContain("d2");
    const zip = buildRecallZip(manifest);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(zip)).toContain("images/");
    expect(new TextDecoder().decode(zip)).toContain("复盘.md");
  });

  it("binds each snapshot image to its own phase and both raw cutoffs", () => {
    const manifest = createRecallExportManifest(documentWith([
      snapshot("s0", "decision-1", [], {
        phase: "pre-entry",
        cursor: "2026-01-02T04:29:59.999Z",
        executionCursor: "__recall_before_first_execution__",
      }),
      snapshot("s1", "decision-1", [], {
        phase: "holding",
        cursor: "2026-01-03T04:30:00.000Z",
        executionCursor: "exec-1",
      }),
    ], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    const markdown = buildRecallMarkdown(manifest);
    expect(markdown).toContain("> 阶段：S0 买入前判断；行情可知截止：2026-01-02T04:29:59.999Z；成交揭示截止：__recall_before_first_execution__");
    expect(markdown).toContain("> 阶段：S1 持仓过程；行情可知截止：2026-01-03T04:30:00.000Z；成交揭示截止：exec-1");
    expect(manifest.snapshots.map((value) => [value.phase, value.cursor, value.executionCursor])).toEqual([
      ["pre-entry", "2026-01-02T04:29:59.999Z", "__recall_before_first_execution__"],
      ["holding", "2026-01-03T04:30:00.000Z", "exec-1"],
    ]);
  });

  it("uses the explicit phase for numbered, global, and unassigned branches", () => {
    const manifest = createRecallExportManifest(documentWith([
      snapshot("global-s0", "global", [], { phase: "pre-entry", cursor: "g0", executionCursor: "e0" }),
      snapshot("unassigned-s1", "unassigned", [], { phase: "holding", cursor: "g1", executionCursor: "e1" }),
      snapshot("numbered-s2", "decision-1", [], { phase: "post-review", cursor: "g2", executionCursor: "e2" }),
    ], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    const markdown = buildRecallMarkdown(manifest);
    expect(markdown).toContain("> 阶段：S0 买入前判断；行情可知截止：g0；成交揭示截止：e0");
    expect(markdown).toContain("> 阶段：S1 持仓过程；行情可知截止：g1；成交揭示截止：e1");
    expect(markdown).toContain("> 阶段：S2 事后复盘；行情可知截止：g2；成交揭示截止：e2");
    expect(markdown.indexOf("global.png")).toBeGreaterThan(-1);
    expect(markdown.indexOf("待分配快照")).toBeGreaterThan(-1);
  });

  it("marks phase and each cutoff independently when a legacy snapshot omits one", () => {
    const known = { cursor: "timestamp-like-value", executionCursor: "stable-execution-id" };
    const missingPhase = withoutSnapshotField(snapshot("missing-phase", "decision-1", [], { ...known }), "phase");
    const missingCursor = withoutSnapshotField(snapshot("missing-cursor", "decision-1", [], { phase: "holding", ...known }), "cursor");
    const missingExecution = withoutSnapshotField(snapshot("missing-execution", "decision-1", [], { phase: "post-review", ...known }), "executionCursor");
    const markdown = buildRecallMarkdown(createRecallExportManifest(documentWith([
      missingPhase, missingCursor, missingExecution,
    ], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" }));
    expect(markdown).toContain("> 阶段：未知；行情可知截止：timestamp-like-value；成交揭示截止：stable-execution-id");
    expect(markdown).toContain("> 阶段：S1 持仓过程；行情可知截止：未知；成交揭示截止：stable-execution-id");
    expect(markdown).toContain("> 阶段：S2 事后复盘；行情可知截止：timestamp-like-value；成交揭示截止：未知");
  });

  it("exports completed retained snapshots while the working state is at a later phase", () => {
    const retained = snapshot("retained-s0", "decision-1", [], {
      phase: "pre-entry",
      cursor: "s0-market",
      executionCursor: "__recall_before_first_execution__",
    });
    const current = snapshot("working-s2", "decision-1", [], {
      phase: "post-review",
      cursor: "s2-market",
      executionCursor: "exit-1",
    });
    const input = documentWith([current], "in-progress");
    input.working.phase = "post-review";
    input.lastCompleted = {
      ...documentWith([retained], "completed"),
      completedAt: "2026-01-04T00:00:00.000Z",
      status: "completed",
    };
    const manifest = createRecallExportManifest(input, episode, {
      source: "completed",
      generatedAt: "2026-01-04T00:00:00.000Z",
    });
    const markdown = buildRecallMarkdown(manifest);
    expect(manifest.snapshots.map((value) => value.id)).toEqual(["retained-s0"]);
    expect(markdown).toContain("s0-market");
    expect(markdown).not.toContain("s2-market");
    expect(markdown).not.toContain("working-s2");

    const noCompletedVersion = documentWith([current], "in-progress");
    expect(() => createRecallExportManifest(noCompletedVersion, episode, {
      source: "completed",
      generatedAt: "2026-01-04T00:00:00.000Z",
    })).toThrow("没有可导出的上次完成版本");
  });

  it("keeps phase and cutoff captions attached when the caller reorders snapshots", () => {
    const order = ["s2", "s0", "s1"];
    const manifest = createRecallExportManifest(documentWith([
      snapshot("s0", "decision-1", [], { phase: "pre-entry", cursor: "c0", executionCursor: "e0" }),
      snapshot("s1", "decision-1", [], { phase: "holding", cursor: "c1", executionCursor: "e1" }),
      snapshot("s2", "decision-1", [], { phase: "post-review", cursor: "c2", executionCursor: "e2" }),
    ], "completed"), episode, {
      order: { snapshotIds: order },
      generatedAt: "2026-01-04T00:00:00.000Z",
    });
    const markdown = buildRecallMarkdown(manifest);
    expect(manifest.snapshots.map((value) => value.id)).toEqual(order);
    for (const [index, [phase, cursor, executionCursor]] of [
      ["S2 事后复盘", "c2", "e2"],
      ["S0 买入前判断", "c0", "e0"],
      ["S1 持仓过程", "c1", "e1"],
    ].entries()) {
      const image = `images/01_0${index + 1}_1D.png`;
      const imageAt = markdown.indexOf(`![1D](${image})`);
      expect(imageAt).toBeGreaterThan(-1);
      expect(markdown.slice(imageAt, imageAt + 180)).toContain(`阶段：${phase}；行情可知截止：${cursor}；成交揭示截止：${executionCursor}`);
    }
  });

  it("freezes projected stage facts and Markdown bytes independently of later source mutations", () => {
    const sourceSnapshots = [
      snapshot("s0", "decision-1", [drawing("d0", "frozen", 1)], { phase: "pre-entry", cursor: "c0", executionCursor: "e0" }),
      snapshot("s1", "decision-1", [], { phase: "holding", cursor: "c1", executionCursor: "e1" }),
    ];
    const requestedOrder = ["s1", "s0"];
    const manifest = createRecallExportManifest(documentWith(sourceSnapshots, "completed"), episode, {
      order: { snapshotIds: requestedOrder },
      generatedAt: "2026-01-04T00:00:00.000Z",
    });
    const beforeMarkdown = buildRecallMarkdown(manifest);
    const beforeImageBytes = manifest.files.filter((file) => file.kind === "image").map((file) => [...file.bytes]);
    sourceSnapshots[0].phase = "post-review";
    sourceSnapshots[0].cursor = "working-cursor";
    sourceSnapshots[0].executionCursor = "working-execution";
    sourceSnapshots.reverse();
    requestedOrder.reverse();
    expect(buildRecallMarkdown(manifest)).toBe(beforeMarkdown);
    expect(manifest.files.filter((file) => file.kind === "image").map((file) => [...file.bytes])).toEqual(beforeImageBytes);
    expect(manifest.snapshots.map((value) => [value.id, value.phase, value.cursor, value.executionCursor])).toEqual([
      ["s1", "holding", "c1", "e1"],
      ["s0", "pre-entry", "c0", "e0"],
    ]);
    expect(Object.isFrozen(manifest.snapshots[0])).toBe(true);
  });

  it("writes large image entries without spreading bytes into the call stack", () => {
    const imageBytes = Array.from(new Uint8Array(256_000).fill(0x5a));
    const manifest: RecallExportManifest = {
      source: "draft",
      folderName: "large-export",
      baseName: "large-export",
      markdownName: "large-export.md",
      timezone: "UTC",
      generatedAt: "2026-01-04T00:00:00.000Z",
      status: "in-progress",
      files: [{
        path: "images/large.png",
        kind: "image",
        mimeType: "image/png",
        bytes: imageBytes,
      }],
      snapshots: [],
      textEntries: [],
      warnings: [],
    };

    const zip = buildRecallZip(manifest);
    expect(zip.length).toBeGreaterThan(imageBytes.length);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});

class MemoryDirectory implements RecallDirectoryHandle {
  readonly dirs = new Map<string, MemoryDirectory>();
  readonly files = new Map<string, { bytes: Uint8Array; mime: string }>();
  constructor(
    readonly name?: string,
    private readonly failFile?: string,
    private readonly failFileErrorName = "Error",
    private readonly collisionDirectoryName?: string,
  ) {}

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
    if (!options.create && this.collisionDirectoryName === name) {
      const error = new Error("path is a file");
      Object.assign(error, { name: "TypeMismatchError" });
      throw error;
    }
    const existing = this.dirs.get(name);
    if (existing) return existing;
    if (!options.create) {
      const error = new Error("not found");
      Object.assign(error, { name: "NotFoundError" });
      throw error;
    }
    const created = new MemoryDirectory(name, this.failFile, this.failFileErrorName, this.collisionDirectoryName);
    this.dirs.set(name, created);
    return created;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}) {
    if (this.failFile === name) {
      const error = new Error("write denied");
      Object.assign(error, { name: this.failFileErrorName });
      throw error;
    }
    if (!options.create && !this.files.has(name)) {
      const error = new Error("not found");
      Object.assign(error, { name: "NotFoundError" });
      throw error;
    }
    return {
      createWritable: async () => ({
        write: async (value: Blob) => {
          this.files.set(name, { bytes: new Uint8Array(await value.arrayBuffer()), mime: value.type });
        },
        close: async () => undefined,
      }),
    };
  }
}

describe("recall export directory writer", () => {
  it("increments collisions and writes images before markdown", async () => {
    const manifest = createRecallExportManifest(documentWith([snapshot("s1", "decision-1", [])], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    const root = new MemoryDirectory("exports");
    await root.getDirectoryHandle(manifest.folderName, { create: true });
    const result = await writeRecallExportDirectory(manifest, root);
    expect(result.status).toBe("success");
    expect(result.folderName).toBe(`${manifest.folderName}_02`);
    expect(result.writtenFiles).toBe(manifest.files.length);
    expect(root.dirs.get(`${manifest.folderName}_02`)?.dirs.has("images")).toBe(true);
  });

  it("reports partial writes with a path and count, without cleanup", async () => {
    const manifest = createRecallExportManifest(documentWith([snapshot("s1", "decision-1", [])], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    const root = new MemoryDirectory("exports", manifest.markdownName);
    const result = await writeRecallExportDirectory(manifest, root);
    expect(result.status).toBe("partial");
    expect(result.displayPath).toContain(manifest.folderName);
    expect(result.writtenFiles).toBe(1);
    expect(root.dirs.get(manifest.folderName)).toBeDefined();
  });

  it("skips a file-name collision and reports an interrupted write as partial", async () => {
    const manifest = createRecallExportManifest(documentWith([snapshot("s1", "decision-1", [])], "completed"), episode, { generatedAt: "2026-01-04T00:00:00.000Z" });
    const collisionRoot = new MemoryDirectory("exports", undefined, "Error", manifest.folderName);
    const collisionResult = await writeRecallExportDirectory(manifest, collisionRoot);
    expect(collisionResult.status).toBe("success");
    expect(collisionResult.folderName).toBe(`${manifest.folderName}_02`);

    const abortRoot = new MemoryDirectory("exports", manifest.markdownName, "AbortError");
    const abortResult = await writeRecallExportDirectory(manifest, abortRoot);
    expect(abortResult.status).toBe("partial");
    expect(abortResult.writtenFiles).toBe(1);
  });
});
