import { describe, expect, it } from "vitest";

import { createThreeStageExportManifest, THREE_STAGE_LAYOUT, threeStageTextPixelWidth, wrapThreeStageText } from "./three-stage-manifest";
import type { RecallDocument, RecallSnapshot } from "../recall/types";
import { sha256 } from "../recall/retained-digest";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
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

function documentWithStages(): RecallDocument {
  const snapshots: RecallSnapshot[] = ["pre-entry", "holding", "post-review"].map((phase, index) => ({
    id: `snapshot-${phase}`,
    decisionId: index === 2 ? "global" : `decision-${index}`,
    phase: phase as "pre-entry" | "holding" | "post-review",
    timeframe: "1D",
    cursor: `2026-01-0${index + 1}`,
    executionCursor: `2026-01-0${index + 1}`,
    candles: [],
    drawings: [{ id: `text-${index}`, tool: "text", text: `第${index + 1}阶段原文`, textRevision: index + 1, recallOwnerId: `decision-${index}`, anchors: [{ time: "2026-01-01", price: 56 }] } as unknown as RecallSnapshot["drawings"][number]],
    imageDataUrl: png,
    viewport: { version: 1, logicalRange: null, barSpacing: 6, rightOffset: 0, width: 1440, height: 810, imageFrame: { version: 1, width: 1440, height: 810, pixelRatio: 1 } },
    createdAt: `2026-01-0${index + 1}`,
    updatedAt: `2026-01-0${index + 1}`,
  }));
  snapshots[2].retainedBundleId = "bundle-global";
  const executions = [
    { id: "buy-1000", side: "buy" as const, executedAt: "2026-01-01T10:00:00Z", quantity: "1000", price: "100", fee: "12", source: { platform: "broker", row: 1 }, accountId: "a", accountLabel: "A", instrument: { id: "US:T", symbol: "T", name: "标的", market: "US", currency: "USD" } },
    { id: "sell-400", side: "sell" as const, executedAt: "2026-01-02T10:00:00Z", quantity: "400", price: "110", fee: "8", source: { platform: "broker", row: 2 }, accountId: "a", accountLabel: "A", instrument: { id: "US:T", symbol: "T", name: "标的", market: "US", currency: "USD" } },
    { id: "sell-600", side: "sell" as const, executedAt: "2026-01-03T10:00:00Z", quantity: "600", price: "120", fee: "10", source: { platform: "broker", row: 3 }, accountId: "a", accountLabel: "A", instrument: { id: "US:T", symbol: "T", name: "标的", market: "US", currency: "USD" } },
  ];
  const evidenceExecutions = executions.map(({ accountLabel, instrument, ...item }) => {
    void accountLabel;
    return { ...item, instrument: { id: instrument.id, symbol: instrument.symbol, market: instrument.market, currency: instrument.currency } };
  });
  return {
    version: 1, episodeId: "episode", revision: 7, snapshots, decisions: [], status: "completed", updatedAt: "2026-01-03",
    working: { drawings: [], timeframe: "1D", cursor: "2026-01-03", executionCursor: "2026-01-03", selectedDecisionId: null },
    retainedBundles: [{ id: "bundle-global", snapshotId: "snapshot-post-review", documentRevision: 7, retainedAt: "2026-01-03", executionEvidence: { version: 1, executionIds: executions.map(item => item.id), digest: "digest", payload: { episode: { id: "episode", accountId: "a", direction: "long", status: "closed", startedAt: "2026-01-01", openingQuantity: "1000", remainingQuantity: "0", instrument: { id: "US:T", symbol: "T", market: "US", currency: "USD" } }, executions: evidenceExecutions } }, decisions: [], captureContext: { phase: "post-review", cursor: "2026-01-03", executionCursor: "2026-01-03", timeframe: "1D", viewport: snapshots[2].viewport }, planVersionIds: [], riskBaselineIds: [] }],
    storyboard: { "pre-entry": { snapshotId: "snapshot-pre-entry" }, holding: { snapshotId: "snapshot-holding" }, "post-review": { snapshotId: "snapshot-post-review" } },
  };
}

function attachValidDerivedCapture(snapshot: RecallSnapshot): void {
  const drawing = snapshot.drawings.find(candidate => candidate.tool === "text" && typeof candidate.text === "string");
  if (!drawing) throw new Error("test fixture requires a text drawing");
  const revision = drawing.textRevision === undefined ? `legacy:${drawing.id}` : String(drawing.textRevision);
  const sourceKey = `${snapshot.id}:${drawing.id}:${revision}`;
  const anchor = (drawing as { anchors?: Array<{ time?: string; price?: number }> }).anchors?.[0];
  const derivedPng = pngWithDimensions(864, 560);
  Object.assign(snapshot, {
    derivedCapture: {
      version: 1,
      imageDataUrl: derivedPng,
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

describe("three stage export manifest", () => {
  it("selects a validated same-source derived PNG while retaining full body provenance", () => {
    const input = documentWithStages();
    const derivedPng = pngWithDimensions(864, 560);
    Object.assign(input.snapshots[0], {
      derivedCapture: {
        version: 1,
        imageDataUrl: derivedPng,
        imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
        rendererVersion: "canonical-chart-capture-r10",
        sourceCanonicalDigest: sha256(png),
        textOverlayPolicy: "body-only",
        textSourceKeys: ["snapshot-pre-entry:text-0:1"],
        textSourceBindings: [{ sourceKey: "snapshot-pre-entry:text-0:1", sourceNumber: 1, drawingId: "text-0", status: "visible-anchor", anchorTime: "2026-01-01", anchorPrice: 56 }],
        warnings: [],
      },
    });
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");

    expect(stage?.imageDataUrl).toBe(derivedPng);
    expect(stage?.contentRows.some(row => row.text.includes("第1阶段原文"))).toBe(true);
    expect(stage?.contentRows.some(row => row.text.includes("来源1") && row.text.includes("2026-01-01") && row.text.includes("56"))).toBe(true);
    expect(JSON.stringify(manifest)).toContain("body-only");
    expect(JSON.stringify(manifest)).toContain("snapshot-pre-entry:text-0:1");
  });

  it("falls back to canonical PNG with an explicit warning when derived provenance mismatches", () => {
    const input = documentWithStages();
    Object.assign(input.snapshots[0], {
      derivedCapture: {
        version: 1,
        imageDataUrl: "data:image/png;base64,AA==",
        imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
        rendererVersion: "canonical-chart-capture-r10",
        sourceCanonicalDigest: "b".repeat(64),
        textOverlayPolicy: "body-only",
        textSourceKeys: [],
        warnings: [],
      },
    });
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");

    expect(stage?.imageDataUrl).toBe(png);
    expect(stage?.warnings.some(warning => /derived|canonical|fallback/i.test(warning))).toBe(true);
  });

  it("rejects a metadata-only derived image whose raster is not 864×560", () => {
    const input = documentWithStages();
    Object.assign(input.snapshots[0], {
      derivedCapture: {
        version: 1,
        imageDataUrl: png,
        imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
        rendererVersion: "canonical-chart-capture-r10",
        sourceCanonicalDigest: sha256(png),
        textOverlayPolicy: "body-only",
        textSourceKeys: ["snapshot-pre-entry:text-0:1"],
        textSourceBindings: [{ sourceKey: "snapshot-pre-entry:text-0:1", sourceNumber: 1, drawingId: "text-0", status: "visible-anchor" }],
        warnings: [],
      },
    });
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");
    expect(stage?.imageDataUrl).toBe(png);
    expect(stage?.warningCodes).toContain("derived-fallback");
  });

  it("keeps realistic original/current/final bodies and their compact source rows", () => {
    const input = documentWithStages();
    const bodies = [
      "观察大盘结构与成交变化\n等待回踩确认后执行",
      "价格进入计划区间\n关注承接力度与风险边界",
      "复盘执行与退出质量\n记录偏差并更新下次规则",
    ];
    input.snapshots.forEach((snapshot, index) => {
      const drawingId = `text-${index}`;
      const sourceKey = `${snapshot.id}:${drawingId}:${index + 1}`;
      snapshot.drawings = [{
        id: drawingId, tool: "text", text: bodies[index], textRevision: index + 1,
        recallOwnerId: snapshot.decisionId, anchors: [{ time: "2026-01-01T08:00:00Z", price: 56 + index }],
      } as unknown as RecallSnapshot["drawings"][number]];
      Object.assign(snapshot, {
        derivedCapture: {
          version: 1, imageDataUrl: pngWithDimensions(864, 560),
          imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
          rendererVersion: "canonical-chart-capture-r10", sourceCanonicalDigest: sha256(snapshot.imageDataUrl),
          textOverlayPolicy: "body-only", textSourceKeys: [sourceKey],
          textSourceBindings: [{ sourceKey, sourceNumber: 1, drawingId, status: "visible-anchor", anchorTime: "2026-01-01T08:00:00Z", anchorPrice: 56 + index }],
          warnings: [],
        },
      });
    });
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.contentOverflow).toBe(false);
    manifest.stages.forEach((stage, index) => {
      expect(stage.texts[0]?.text).toBe(bodies[index]);
      expect(stage.contentRows.some(row => row.kind === "text" && row.text.includes(bodies[index]))).toBe(true);
      expect(stage.contentRows.some(row => row.kind === "meta" && row.text.includes("来源1") && row.text.includes(String(56 + index)))).toBe(true);
    });
  });

  it("freezes the selected source and keeps all accepted execution rows", () => {
    const input = documentWithStages();
    const manifest = createThreeStageExportManifest(input, { generatedAt: "2026-01-04T00:00:00.000Z" });
    input.snapshots[0].drawings[0].text = "后来改写的工作稿";
    expect(manifest.stages[0].texts[0].text).toBe("第1阶段原文");
    expect(manifest.executions.map(item => [item.quantity, item.fee])).toEqual([["1000", "12"], ["400", "8"], ["600", "10"]]);
    expect(Object.isFrozen(manifest)).toBe(true);
  });

  it("keeps missing phases and missing saved images explicit", () => {
    const input = documentWithStages();
    (input.snapshots[0] as unknown as { imageDataUrl?: string }).imageDataUrl = undefined;
    input.storyboard = { "pre-entry": { snapshotId: "snapshot-pre-entry" }, holding: { snapshotId: "does-not-exist" } };
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.stages.find(stage => stage.phase === "holding")?.warningCodes).toContain("missing-phase");
    expect(manifest.stages.find(stage => stage.phase === "pre-entry")?.warningCodes).toContain("missing-image");
  });

  it("marks long text as overflow without truncating it", () => {
    const input = documentWithStages();
    input.snapshots[0].drawings[0].text = "长文本".repeat(600);
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.contentOverflow).toBe(true);
    expect(manifest.stages[0].texts[0].text).toHaveLength(1800);
    expect(manifest.warningCodes).toContain("content-overflow");
  });

  it("wraps by pixel width and counts aggregate stage content", () => {
    expect(threeStageTextPixelWidth("中".repeat(30))).toBe(420);
    expect(wrapThreeStageText("中".repeat(30))).toHaveLength(2);
    const input = documentWithStages();
    input.snapshots[0].drawings.push(
      { id: "text-extra-1", tool: "text", text: "补充判断" } as unknown as RecallSnapshot["drawings"][number],
      { id: "text-extra-2", tool: "text", text: "当前补充" } as unknown as RecallSnapshot["drawings"][number],
      { id: "text-extra-3", tool: "text", text: "最终与补记来源" } as unknown as RecallSnapshot["drawings"][number],
      { id: "text-extra-4", tool: "text", text: "额外补记" } as unknown as RecallSnapshot["drawings"][number],
      { id: "text-extra-5", tool: "text", text: "继续补充" } as unknown as RecallSnapshot["drawings"][number],
    );
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");
    expect(stage?.contentPixelHeight).toBeGreaterThan(stage?.contentPixelBudget ?? 0);
    expect(stage?.warningCodes).toContain("content-overflow");
    expect(manifest.contentOverflow).toBe(true);
    expect(stage?.texts.map(text => text.text)).toEqual(expect.arrayContaining(["补充判断", "当前补充", "最终与补记来源"]));
  });

  it("keeps a complete two-line body within the fixed card budget without long IDs", () => {
    const input = documentWithStages();
    input.snapshots[0].drawings[0].text = "原始判断\n当前补充";
    input.snapshots.forEach(attachValidDerivedCapture);
    const bundle = input.retainedBundles![0];
    bundle.id = `bundle-${"x".repeat(180)}`;
    bundle.executionEvidence.digest = `digest-${"d".repeat(180)}`;
    bundle.executionEvidence.payload.executions = bundle.executionEvidence.payload.executions.map((execution) => ({
      ...execution,
      id: `execution-${"e".repeat(180)}`,
    }));
    bundle.executionEvidence.executionIds = bundle.executionEvidence.payload.executions.map((execution) => execution.id);
    input.snapshots[2].retainedBundleId = bundle.id;
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry");
    expect(stage?.contentPixelHeight).toBeLessThanOrEqual(stage?.contentPixelBudget ?? 0);
    expect(stage?.warningCodes).not.toContain("content-overflow");
    expect(stage?.contentRows.filter(row => row.kind === "text")).toHaveLength(1);
    expect(manifest.executions[0]?.id).toContain("execution-");
    expect(manifest.contentOverflow).toBe(false);
  });

  it("uses frozen instrument identity and rejects a different episode source", () => {
    const input = documentWithStages();
    const identity = { episodeId: "episode", symbol: "T", name: "测试标的", market: "US", currency: "USD" };
    const manifest = createThreeStageExportManifest(input, { instrument: identity });
    expect(manifest.instrument).toEqual({ symbol: "T", name: "测试标的", market: "US", currency: "USD" });
    expect(() => createThreeStageExportManifest(input, { instrument: { ...identity, episodeId: "other-episode" } })).toThrow(/episode/);
  });

  it("preserves unknown forming phase and chooses the fullest accepted bundle", () => {
    const input = documentWithStages();
    const original = input.retainedBundles![0];
    const early = structuredClone(original);
    early.id = "bundle-early-empty";
    early.snapshotId = "snapshot-holding";
    early.executionEvidence.payload.executions = [structuredClone(original.executionEvidence.payload.executions[0])];
    early.executionEvidence.executionIds = [early.executionEvidence.payload.executions[0].id];
    input.snapshots[1].retainedBundleId = early.id;
    input.retainedBundles = [early, original];
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.acceptedBundleId).toBe(original.id);
    expect(manifest.executions).toHaveLength(3);
    expect(manifest.allRecordIndex.filter(record => record.kind === "execution")).toHaveLength(4);
    expect(manifest.stages[0].texts[0]?.formingPhase).toBeUndefined();
    expect(manifest.stages[0].contentRows.some(row => row.text.includes("形成阶段未提供："))).toBe(true);
  });

  it("keeps mixed text forming phases and future visibility readable per entry", () => {
    const input = documentWithStages();
    input.snapshots[0].drawings = [
      { id: "original", tool: "text", text: "原始判断", stage: "pre-trade", recallHasSeenFuture: false } as unknown as RecallSnapshot["drawings"][number],
      { id: "backfill", tool: "text", text: "复盘补记", stage: "post-review", recallHasSeenFuture: true } as unknown as RecallSnapshot["drawings"][number],
    ];
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "pre-entry")!;
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("原始判断");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("复盘补记");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("原始判断");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("入场前判断：原始判断");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("事后复盘：复盘补记");
    expect(stage.contentRows.find(row => row.kind === "meta" && row.text.startsWith("正文角色："))?.text).toContain("原判断·后续否");
  });

  it("fits the real three-text stage shape while retaining readable provenance and raw cutoffs in the index", () => {
    const input = documentWithStages();
    input.snapshots[0].viewport = {
      ...input.snapshots[0].viewport!,
      priceRange: { from: 55, to: 57 },
      priceScaleOptions: { mode: 0, invertScale: false, autoScale: true, scaleMargins: { bottom: 0.2, top: 0.08 } },
    };
    input.snapshots[1].cursor = "2026-01-08T07:00:00.000Z";
    input.snapshots[1].executionCursor = "buy-1000";
    input.snapshots[1].viewport = {
      ...input.snapshots[1].viewport!,
      priceRange: { from: 55, to: 57 },
      priceScaleOptions: { mode: 0, invertScale: false, autoScale: true, scaleMargins: { bottom: 0.2, top: 0.08 } },
    };
    input.snapshots[1].drawings = [
      { id: "original", tool: "text", text: "原判断\n当前结构", stage: "pre-trade", recallHasSeenFuture: false } as unknown as RecallSnapshot["drawings"][number],
      { id: "supplement", tool: "text", text: "持仓补记\n继续观察", stage: "during-replay", recallHasSeenFuture: true } as unknown as RecallSnapshot["drawings"][number],
    ];
    input.snapshots[2].cursor = "2026-06-19T07:00:00.000Z";
    input.snapshots[2].executionCursor = "sell-600";
    input.snapshots[2].viewport = {
      ...input.snapshots[2].viewport!,
      priceRange: { from: 50, to: 70 },
      priceScaleOptions: { mode: 0, invertScale: false, autoScale: false, scaleMargins: { bottom: 0.2, top: 0.08 } },
    };
    input.snapshots[2].decisionId = "d3";
    input.snapshots[2].drawings = [
      { id: "original-s2", tool: "text", text: "回撤后观察承接，站回 56 再考虑做多。\n跌破 52 则结构失效；止盈目标 68。", stage: "pre-trade", recallHasSeenFuture: false } as unknown as RecallSnapshot["drawings"][number],
      { id: "supplement-s2", tool: "text", text: "买入已揭示，先按原计划持有。\n跌破 52 再检查结构。", stage: "during-replay", recallHasSeenFuture: true } as unknown as RecallSnapshot["drawings"][number],
      { id: "conclusion-s2", tool: "text", text: "分批止盈执行稳定，下一次保留更多趋势空间。", stage: "post-review", recallHasSeenFuture: true } as unknown as RecallSnapshot["drawings"][number],
    ];
    const manifest = createThreeStageExportManifest(input);
    const holding = manifest.stages.find(stage => stage.phase === "holding")!;
    const postReview = manifest.stages.find(stage => stage.phase === "post-review")!;
    expect(holding.contentPixelHeight).toBeLessThanOrEqual(holding.contentPixelBudget);
    expect(postReview.contentPixelHeight).toBeLessThanOrEqual(postReview.contentPixelBudget);
    expect(postReview.contentRows.map(row => row.text).join("\n")).toContain("入场前判断：回撤后观察承接");
    expect(postReview.contentRows.map(row => row.text).join("\n")).toContain("持仓过程：买入已揭示");
    expect(postReview.contentRows.map(row => row.text).join("\n")).toContain("事后复盘：分批止盈执行稳定");
    expect(postReview.contentRows.map(row => row.text).join("\n")).toContain("成交截止 卖出600股·2026年01月03日 18:00");
    expect(postReview.contentRows.map(row => row.text).join("\n")).toContain("正文角色：原判断·后续否；当前补充·后续是；最终结论·后续是");
    expect(postReview.contentRows.map(row => row.text).join("\n")).not.toContain("sell-600");
    expect(manifest.allRecordIndex.flatMap(record => record.details ?? [])).toContain("成交截止：sell-600");
  });

  it("allows the locked complete 2+2+1-line stage body within the calibrated card budget", () => {
    const input = documentWithStages();
    input.snapshots.forEach(snapshot => {
      snapshot.viewport = { ...snapshot.viewport!, priceRange: { from: 50, to: 70 }, priceScaleOptions: { mode: 0, invertScale: false, autoScale: false, scaleMargins: { bottom: 0.2, top: 0.08 } } };
    });
    attachValidDerivedCapture(input.snapshots[0]);
    attachValidDerivedCapture(input.snapshots[1]);
    input.snapshots[2].drawings = [
      { id: "original-s2", tool: "text", text: "回撤后观察承接，站回 56 再考虑做多。\n跌破 52 则结构失效。", stage: "pre-trade", recallHasSeenFuture: false, textRevision: 1, anchors: [{ time: "2026-03-16T00:00:00.000Z", price: 56 }] } as unknown as RecallSnapshot["drawings"][number],
      { id: "supplement-s2", tool: "text", text: "买入已揭示，先按原计划持有。\n跌破 52 再检查结构。", stage: "during-replay", recallHasSeenFuture: true, textRevision: 2, anchors: [{ time: "2026-03-17T00:00:00.000Z", price: 57.04 }] } as unknown as RecallSnapshot["drawings"][number],
      { id: "conclusion-s2", tool: "text", text: "分批止盈执行稳定，下一次保留更多趋势空间。", stage: "post-review", recallHasSeenFuture: true, textRevision: 3, anchors: [{ time: "2026-06-18T00:00:00.000Z", price: 63.69 }] } as unknown as RecallSnapshot["drawings"][number],
    ];
    Object.assign(input.snapshots[2], {
      derivedCapture: {
        version: 1, imageDataUrl: pngWithDimensions(864, 560), imageFrame: { version: 1, width: 432, height: 280, pixelRatio: 2 },
        rendererVersion: "canonical-chart-capture-r10", sourceCanonicalDigest: sha256(png), textOverlayPolicy: "body-only",
        textSourceKeys: ["snapshot-post-review:original-s2:1", "snapshot-post-review:supplement-s2:2", "snapshot-post-review:conclusion-s2:3"],
        textSourceBindings: [
          { sourceKey: "snapshot-post-review:original-s2:1", sourceNumber: 1, drawingId: "original-s2", status: "visible-anchor", anchorTime: "2026-03-16T00:00:00.000Z", anchorPrice: 56 },
          { sourceKey: "snapshot-post-review:supplement-s2:2", sourceNumber: 2, drawingId: "supplement-s2", status: "visible-anchor", anchorTime: "2026-03-17T00:00:00.000Z", anchorPrice: 57.04 },
          { sourceKey: "snapshot-post-review:conclusion-s2:3", sourceNumber: 3, drawingId: "conclusion-s2", status: "visible-anchor", anchorTime: "2026-06-18T00:00:00.000Z", anchorPrice: 63.69 },
        ], warnings: [],
      },
    });
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "post-review")!;

    expect(stage.contentPixelHeight).toBe(165);
    expect(stage.contentPixelBudget).toBeGreaterThanOrEqual(stage.contentPixelHeight);
    expect(stage.warningCodes).not.toContain("content-overflow");
    expect(manifest.contentOverflow).toBe(false);
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("回撤后观察承接");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("买入已揭示");
    expect(stage.contentRows.map(row => row.text).join("\n")).toContain("分批止盈执行稳定");
  });

  it("keeps full market and execution cutoffs in independent one-line rows above the chart", () => {
    const input = documentWithStages();
    input.snapshots[2].cursor = "2026-03-18T06:59:00.000Z";
    input.snapshots[2].executionCursor = "sell-600";
    const manifest = createThreeStageExportManifest(input);
    const stage = manifest.stages.find(candidate => candidate.phase === "post-review")!;
    const cutoffRows = stage.contentRows.filter(row => row.placement === "before-image" && /^(行情截止|成交截止)/.test(row.text));

    expect(cutoffRows).toHaveLength(2);
    expect(cutoffRows.map(row => row.text).join("\n")).toContain("行情截止");
    expect(cutoffRows.map(row => row.text).join("\n")).toContain("成交截止");
    expect(cutoffRows.every(row => row.lines.length === 1)).toBe(true);
    expect(THREE_STAGE_LAYOUT.preImageTop + cutoffRows.reduce((height, row) => height + row.lines.length * THREE_STAGE_LAYOUT.metaLineHeight, 0)).toBeLessThanOrEqual(THREE_STAGE_LAYOUT.imageY);
  });

  it("rejects same-episode instrument code, market, or currency spoofing", () => {
    const input = documentWithStages();
    const identity = { episodeId: "episode", symbol: "T", name: "测试标的", market: "US", currency: "USD" };
    expect(() => createThreeStageExportManifest(input, { instrument: { ...identity, symbol: "FAKE" } })).toThrow(/instrument/);
    expect(() => createThreeStageExportManifest(input, { instrument: { ...identity, market: "CN" } })).toThrow(/instrument/);
    expect(() => createThreeStageExportManifest(input, { instrument: { ...identity, currency: "CNY" } })).toThrow(/instrument/);
  });

  it("indexes manual evaluations, risk baselines, and plan associations with accepted selection state", () => {
    const input = documentWithStages();
    input.plans = {
      drafts: [],
      versions: [{ id: "plan-1", planId: "plan-1", decisionId: "decision-1", kind: "initial", input: { direction: "long", currency: "USD", priceBasis: "raw", entry: "100", initialStop: "90", targets: [], sizeInputMode: "quantity", sizeInputValue: "1000", resolvedQuantity: "1000", quantityUnit: "share", capital: null }, recordedPhase: "pre-entry", source: "retrospective", recordedAt: "2026-01-01", knowledgeCutoff: { cursor: "2026-01-01", executionCursor: "2026-01-01" }, hasSeenFuture: false, retainedAt: "2026-01-01" }],
      riskBaselines: [{ id: "risk-1", scope: "decision", decisionId: "decision-1", planVersionId: "plan-1", amount: "100", currency: "USD", method: "fixed-budget", methodVersion: "risk-v1", frozenAt: "2026-01-01" }],
    };
    input.planAssociations = [{ planId: "plan-1", decisionId: "decision-1", status: "needs-confirmation" }];
    input.manualEvaluations = { drafts: [], versions: [{ id: "manual-1", evaluationId: "manual-1", target: { scope: "episode", decisionId: null }, tags: ["analysis"], tagDictionaryVersion: "manual-v1", evidence: [{ kind: "snapshot", snapshotId: "snapshot-post-review" }], source: "manual-retrospective", recordedBy: "user", recordedPhase: "post-review", recordedAt: "2026-01-03", knowledgeCutoff: { cursor: "2026-01-03", executionCursor: "2026-01-03" }, hasSeenFuture: true, retainedAt: "2026-01-03", executionIds: [] }], associations: [] };
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.allRecordIndex.map(record => record.kind)).toEqual(expect.arrayContaining(["manual-evaluation", "risk-baseline", "plan-association"]));
    expect(manifest.allRecordIndex.find(record => record.kind === "plan-association")?.selected).toBe(false);
  });

  it("keeps financial units and unknown reasons in the frozen summary", () => {
    const input = documentWithStages();
    input.retainedBundles![0].actualMetrics = {
      methodVersion: "actual-v1",
      source: { documentRevision: 7, evidenceDigest: "digest", computedAt: "2026-01-03" },
      metrics: {
        actualR: { value: null, reason: "risk-baseline-missing", currency: null, unit: "R", methodVersion: "actual-v1" },
        remainingQuantity: { value: "600", reason: null, currency: null, unit: "share", methodVersion: "actual-v1" },
      },
      exitAllocations: [], denominator: null, executionIds: [], planVersionIds: [], riskBaselineIds: [],
    } as unknown as NonNullable<typeof input.retainedBundles>[number]["actualMetrics"];
    const manifest = createThreeStageExportManifest(input);
    expect(manifest.financial.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "actualR", unit: "R", reason: "risk-baseline-missing" }),
      expect.objectContaining({ key: "remainingQuantity", unit: "share" }),
    ]));
  });
});
