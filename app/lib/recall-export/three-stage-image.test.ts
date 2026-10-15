import { describe, expect, it } from "vitest";

import { buildThreeStageSvg, createThreeStagePngBlob } from "./three-stage-image";
import { createThreeStageExportManifest, THREE_STAGE_LAYOUT } from "./three-stage-manifest";
import type { RecallDocument, RecallSnapshot } from "../recall/types";
import { sha256 } from "../recall/retained-digest";

const baseDocument: RecallDocument = { version: 1, episodeId: "episode", revision: 1, decisions: [], snapshots: [], status: "in-progress", updatedAt: "2026-01-01", working: { drawings: [], timeframe: "1D", cursor: "2026-01-01", executionCursor: "2026-01-01", selectedDecisionId: null } };
const pngWithDimensions = (width: number, height: number) => {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    0x08, 0x06, 0x00, 0x00, 0x00,
  ]);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
};

function attachValidDerivedCapture(snapshot: RecallSnapshot): void {
  const drawing = snapshot.drawings.find(candidate => candidate.tool === "text" && typeof candidate.text === "string");
  if (!drawing) throw new Error("test fixture requires a text drawing");
  const revision = drawing.textRevision === undefined ? `legacy:${drawing.id}` : String(drawing.textRevision);
  const sourceKey = `${snapshot.id}:${drawing.id}:${revision}`;
  const anchor = (drawing as { anchors?: Array<{ time?: string; price?: number }> }).anchors?.[0];
  Object.assign(snapshot, {
    derivedCapture: {
      version: 1,
      imageDataUrl: pngWithDimensions(864, 560),
      imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
      rendererVersion: "canonical-chart-capture-r10",
      sourceCanonicalDigest: sha256(snapshot.imageDataUrl),
      textOverlayPolicy: "body-only",
      textSourceKeys: [sourceKey],
      textSourceBindings: [{
        sourceKey,
        sourceNumber: 1,
        drawingId: drawing.id,
        status: anchor ? "visible-anchor" : "missing-anchor",
        ...(anchor?.time ? { anchorTime: anchor.time } : {}),
        ...(typeof anchor?.price === "number" ? { anchorPrice: anchor.price } : {}),
      }],
      warnings: [],
    },
  });
}

describe("three stage image", () => {
  it("escapes text and keeps a fixed 1440x810 SVG frame", () => {
    const input = structuredClone(baseDocument);
    input.snapshots = [{ id: "s0", decisionId: "d", phase: "pre-entry", timeframe: "1D", cursor: "2026-01-01", executionCursor: "2026-01-01", candles: [], drawings: [{ id: "x", tool: "text", text: "<script>alert(1)</script>", textRevision: 1, anchors: [{ time: "2026-01-01", price: 56 }] } as unknown as RecallSnapshot["drawings"][number]], imageDataUrl: "", createdAt: "2026-01-01", updatedAt: "2026-01-01" } as unknown as RecallSnapshot];
    attachValidDerivedCapture(input.snapshots[0]);
    const manifest = createThreeStageExportManifest(input);
    const svg = buildThreeStageSvg(manifest);
    expect(svg).toContain('width="1440" height="810"');
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain('fill="#0b1220"');
    expect(svg).toContain('fill="#111a2b"');
    expect(svg).toContain('fill="#e7edf6"');
    expect(svg).toContain(`y="${THREE_STAGE_LAYOUT.tableHeaderY}"`);
    expect(svg).not.toContain('y="548"');
    expect(svg).not.toContain(`y="${THREE_STAGE_LAYOUT.tableFirstRowY}"`);
    const withExecution = {
      ...manifest,
      executions: [{ id: "execution-id-that-must-stay-in-the-index", executedAt: "2026-01-01T10:00:00.000Z", side: "buy" as const, quantity: "1", price: "2", fee: "0", currency: "USD", sourceBundleId: "b", sourceDocumentRevision: 1, sourceDigest: "d" }],
    } as typeof manifest;
    const executionSvg = buildThreeStageSvg(withExecution);
    expect(executionSvg).toContain(`y="${THREE_STAGE_LAYOUT.tableFirstRowY}"`);
    expect(executionSvg).toContain("2026年01月01日 18:00");
    expect(executionSvg).toContain("1 股");
    expect(executionSvg).toContain("2 USD");
    expect(executionSvg).toContain("0 USD");
    expect(executionSvg).not.toContain("execution-id-that-must-stay-in-the-index");
  });

  it("renders provenance and honest missing financial evidence", () => {
    const input = structuredClone(baseDocument);
    input.snapshots = [{ id: "s0", decisionId: "d", phase: "pre-entry", timeframe: "1D", cursor: "2026-01-01", executionCursor: "2026-01-01", candles: [], drawings: [{ id: "x", tool: "text", text: "原文判断", textRevision: 1, recallHasSeenFuture: false, anchors: [{ time: "2026-01-01", price: 56 }] } as unknown as RecallSnapshot["drawings"][number]], imageDataUrl: "", createdAt: "2026-01-01", updatedAt: "2026-01-01" } as unknown as RecallSnapshot];
    attachValidDerivedCapture(input.snapshots[0]);
    const svg = buildThreeStageSvg(createThreeStageExportManifest(input));
    expect(svg).toContain("行情截止 2026年01月01日 08:00");
    expect(svg).toContain("形成阶段未提供：");
    expect(createThreeStageExportManifest(input).financial.bundleId).toBeNull();
  });

  it("rejects a canonical fallback whose derived warning would exceed the pre-image budget", () => {
    const input = structuredClone(baseDocument);
    input.snapshots = [{ id: "s0", decisionId: "d", phase: "pre-entry", timeframe: "1D", cursor: "2026-01-01", executionCursor: "2026-01-01", candles: [], drawings: [{ id: "x", tool: "text", text: "原文判断", textRevision: 1, anchors: [{ time: "2026-01-01", price: 56 }] } as unknown as RecallSnapshot["drawings"][number]], imageDataUrl: "data:image/png;base64,AA==", createdAt: "2026-01-01", updatedAt: "2026-01-01" } as unknown as RecallSnapshot];
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");
    expect(stage?.warningCodes).toContain("derived-fallback");
    expect(stage?.warningCodes).toContain("content-overflow");
    expect(() => buildThreeStageSvg(manifest)).toThrow(/content-overflow/);
  });

  it("keeps financial units and unknown reasons readable in the ordinary PNG summary", () => {
    const manifest = createThreeStageExportManifest(baseDocument);
    const withFinancial = {
      ...manifest,
      financial: {
        ...manifest.financial,
        bundleId: "bundle-1",
        metrics: [
          { key: "actualR", label: "实际 R", value: null, reason: "risk-baseline-missing", currency: null, unit: "R" },
          { key: "remainingQuantity", label: "剩余数量", value: "600", reason: null, currency: null, unit: "share" },
        ],
        capitalSources: [
          { planVersionId: "plan-1", amount: "1000", currency: "USD", asOf: "2026-01-01", source: "account-snapshot", snapshotRef: "capital-1" },
          { planVersionId: "plan-2", amount: "2000", currency: "USD", asOf: "2026-01-02", source: "manual-reference", snapshotRef: null },
        ],
      },
    };
    const svg = buildThreeStageSvg(withFinancial);
    expect(withFinancial.financial.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "actualR", unit: "R", reason: "risk-baseline-missing" }),
      expect.objectContaining({ key: "remainingQuantity", unit: "share", value: "600" }),
    ]));
    expect(svg).toContain("完整财务来源见对话框记录索引");
    expect(svg).toContain("600 股");
    expect(svg).toContain("单位：R");
    expect(svg).not.toContain("600 share");
    expect(svg).not.toContain("money");
    expect(svg).not.toContain("quantity");
    expect(svg).not.toContain("等2项");
    expect(withFinancial.financial.bundleId).toBe("bundle-1");
  });

  it("rejects a PNG claim when the fixed frame cannot contain all content", async () => {
    const input = structuredClone(baseDocument);
    input.snapshots = [{ id: "s0", decisionId: "d", phase: "pre-entry", timeframe: "1D", cursor: "2026-01-01", executionCursor: "2026-01-01", candles: [], drawings: [{ id: "x", tool: "text", text: "超长".repeat(1000) } as unknown as RecallSnapshot["drawings"][number]], imageDataUrl: "", createdAt: "2026-01-01", updatedAt: "2026-01-01" } as unknown as RecallSnapshot];
    const manifest = createThreeStageExportManifest(input);
    await expect(createThreeStagePngBlob(manifest)).rejects.toThrow(/content-overflow/);
  });

  it("rejects renderer overflow even when a caller lies about the manifest flag", async () => {
    const input = structuredClone(baseDocument);
    const manifest = createThreeStageExportManifest(input);
    const overflowing = {
      ...manifest,
      contentOverflow: false,
      executions: Array.from({ length: 6 }, (_, index) => ({
        id: `execution-${index}`, executedAt: "2026-01-01", side: "buy" as const, quantity: "1", price: "2", fee: "0", currency: "USD",
        sourceBundleId: "b", sourceDocumentRevision: 1, sourceDigest: "d",
      })),
    } as typeof manifest;
    expect(() => buildThreeStageSvg(overflowing)).toThrow(/content-overflow/);
    await expect(createThreeStagePngBlob(overflowing)).rejects.toThrow(/content-overflow/);
  });

  it("budgets generatedAt and footer text before rendering", () => {
    const input = structuredClone(baseDocument);
    const manifest = createThreeStageExportManifest(input, { generatedAt: "2026-01-01T00:00:00.000Z" });
    const overflowing = { ...manifest, generatedAt: "x".repeat(400) } as typeof manifest;
    expect(() => buildThreeStageSvg(overflowing)).toThrow(/content-overflow/);
  });

  it("uses the calibrated 165px body floor while reserving financial summary space on another card", () => {
    expect(THREE_STAGE_LAYOUT.cardY + THREE_STAGE_LAYOUT.cardHeight - THREE_STAGE_LAYOUT.contentBottom).toBe(THREE_STAGE_LAYOUT.contentBottomInset);
    expect(THREE_STAGE_LAYOUT.contentBottom - THREE_STAGE_LAYOUT.contentTop).toBe(165);
    const manifest = createThreeStageExportManifest(baseDocument);
    const rows = [
      { kind: "text" as const, text: "原判断", lines: ["原判断", "第二行"], placement: "body" as const },
      { kind: "meta" as const, text: "来源1", lines: ["来源1"], placement: "body" as const },
      { kind: "text" as const, text: "当前补充", lines: ["当前补充", "第二行"], placement: "body" as const },
      { kind: "meta" as const, text: "来源2", lines: ["来源2"], placement: "body" as const },
      { kind: "text" as const, text: "最终结论", lines: ["最终结论"], placement: "body" as const },
      { kind: "meta" as const, text: "来源3", lines: ["来源3"], placement: "body" as const },
      { kind: "meta" as const, text: "正文角色", lines: ["正文角色"], placement: "body" as const },
    ];
    const bodyStage = { ...manifest.stages[0], contentRows: rows, contentPixelHeight: 165, contentPixelBudget: 165 };
    const withFinancial = {
      ...manifest,
      stages: [bodyStage, ...manifest.stages.slice(1)],
      financial: { ...manifest.financial, bundleId: "bundle-1" },
      contentOverflow: false,
    } as typeof manifest;
    const svg = buildThreeStageSvg(withFinancial);
    expect(svg).toContain("完整财务来源见对话框记录索引");
    expect(svg).toContain(`y="${THREE_STAGE_LAYOUT.tableHeaderY}"`);
  });
});
