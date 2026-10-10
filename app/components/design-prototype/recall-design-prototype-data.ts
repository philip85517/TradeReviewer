"use client";

import { createRecallDocument, validateRecallDocument } from "../../lib/recall/document";
import { emptyRecallPlanInput } from "../recall/recall-plan-sidebar";
import { applyRecallSizing } from "../../lib/recall/sizing";
import {
  executionsThroughCursor,
  revealableCandlesThroughCursor,
  type RecallReplayCursor,
  NO_REVEALED_EXECUTIONS,
} from "../../lib/replay/recall-replay";
import type { RecallDocument, RecallPhase } from "../../lib/recall/types";
import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";

export const RECALL_PROTOTYPE_STORAGE_KEY = "trade-review:prototype:recall:v1";

export type RecallPrototypeMode = "baseline" | "recommended";

export type RecallPrototypeStageProjection = {
  phase: RecallPhase;
  marketCutoff: string;
  executionCutoff: string | null;
  candles: Candle[];
  executions: TradeEpisode["executions"];
};

export type RecallPrototypeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createRecallPrototypeDocument(
  episode: TradeEpisode,
  now = new Date().toISOString(),
): RecallDocument {
  const initial = createRecallDocument(episode, now);
  const firstExecution = episode.executions[0];
  const preEntryCursor = new Date(Date.parse(firstExecution.executedAt) - 1).toISOString();
  const input = applyRecallSizing({
    ...emptyRecallPlanInput(episode.instrument.currency),
    direction: episode.direction,
    currency: episode.instrument.currency,
    priceBasis: "raw" as const,
    entry: "56",
    initialStop: "52",
    targets: [{ id: "target-1", price: "68", quantity: "1000", ratio: null }],
    sizeInputMode: "quantity" as const,
    sizeInputValue: "1000",
    resolvedQuantity: "1000",
    quantityUnit: "share" as const,
    capital: {
      amount: "200000",
      currency: episode.instrument.currency,
      asOf: preEntryCursor,
      source: "manual-reference" as const,
    },
  });
  const draft = {
    id: "prototype-plan-draft",
    planId: "prototype-plan",
    decisionId: firstExecution.id,
    kind: "initial" as const,
    input,
    recordedPhase: "pre-entry" as const,
    recordedAt: now,
    source: "retrospective" as const,
    knowledgeCutoff: { cursor: preEntryCursor, executionCursor: NO_REVEALED_EXECUTIONS },
    hasSeenFuture: false,
  };
  const entryCursor = episode.executions[0].executedAt;
  const reviewText = "原判断 · S0入场前 · 复盘补记：价格回到前一段整理区上沿，若 56 附近承接成立，计划以 52 作为初始止损，向 68 目标推进。\n不确定性：形成判断时只能确认当前游标以前的行情与证据，成交事实尚未揭示，后续信息随回放游标逐步记录。\n计划：56 入场 · 52 止损 · 68 目标 · 1000 股 · 参考资金 ¥200,000。";
  const holdingText = "当前补充 · S1持仓中 · 复盘补记：买入事实已揭示，记录持仓时的观察。\n观察：价格仍在计划区间内，先核对当前成交与主图已知行情。\n行动：继续按 52 止损、68 目标跟踪，后续事实随回放游标揭示。";
  const textStyle = { color: "#dce8f7", lineWidth: 1.75, opacity: 1 };
  const drawings = [
    {
      version: 2 as const,
      id: "prototype-pre-entry-note",
      episodeId: episode.id,
      name: "买入前判断",
      tool: "text" as const,
      anchors: [{ time: preEntryCursor, price: 56 }],
      style: textStyle,
      zIndex: 0,
      hidden: false,
      locked: false,
      visibleOn: "all" as const,
      stage: "pre-trade" as const,
      createdAtCursor: preEntryCursor,
      placement: "canvas" as const,
      canvasX: 0.04,
      canvasY: 0.08,
      textWidth: 360,
      fontSize: 14 as const,
      background: "rgba(19, 32, 51, 0.94)",
      text: reviewText,
      textRevision: 1,
    },
    {
      version: 2 as const,
      id: "prototype-holding-note",
      episodeId: episode.id,
      name: "持仓过程注释",
      tool: "text" as const,
      anchors: [{ time: entryCursor, price: 60 }],
      style: textStyle,
      zIndex: 1,
      hidden: false,
      locked: false,
      visibleOn: "all" as const,
      stage: "during-replay" as const,
      createdAtCursor: entryCursor,
      placement: "canvas" as const,
      canvasX: 0.04,
      canvasY: 0.64,
      textWidth: 320,
      fontSize: 14 as const,
      background: "rgba(19, 32, 51, 0.94)",
      text: holdingText,
      textRevision: 1,
    },
  ];
  const document: RecallDocument = {
    ...initial,
    working: {
      ...initial.working,
      phase: "pre-entry",
      hasSeenFuture: false,
      cursor: preEntryCursor,
      executionCursor: NO_REVEALED_EXECUTIONS,
      drawings,
    },
    plans: { drafts: [draft], versions: [], riskBaselines: [] },
    planAssociations: [{ planId: "prototype-plan", decisionId: firstExecution.id, status: "linked" }],
  };
  validateRecallDocument(document);
  return document;
}

/**
 * Project exactly what the real replay can show at a persisted cutoff. The
 * return value deliberately contains no future counts, lists, or statistics.
 */
export function projectRecallPrototypeStage(input: {
  phase: RecallPhase;
  candles: Candle[];
  executions: TradeEpisode["executions"];
  cursor: string;
  executionCursor: string;
}): RecallPrototypeStageProjection {
  const executions = executionsThroughCursor(input.executions, input.executionCursor);
  return {
    phase: input.phase,
    marketCutoff: input.cursor,
    executionCutoff: executions.at(-1)?.executedAt ?? null,
    candles: revealableCandlesThroughCursor(input.candles, input.cursor),
    executions,
  };
}

export function createRecallPrototypeRepository(
  storage: RecallPrototypeStorage,
  key: string = RECALL_PROTOTYPE_STORAGE_KEY,
  episode?: TradeEpisode,
) {
  let seeded = false;
  const read = (): RecallDocument | null => {
    const serialized = storage.getItem(key);
    if (!serialized) return null;
    try {
      const parsed = JSON.parse(serialized) as RecallDocument;
      validateRecallDocument(parsed);
      return clone(parsed);
    } catch {
      return null;
    }
  };
  return {
    async load(episodeId: string) {
      const current = read();
      if (current && current.episodeId === episodeId) return current;
      if (!current && !seeded && episode?.id === episodeId) {
        const seeded = createRecallPrototypeDocument(episode);
        storage.setItem(key, JSON.stringify(seeded));
        return clone(seeded);
      }
      return null;
    },
    async fetch(episodeId: string) {
      return this.load(episodeId);
    },
    async save(document: RecallDocument) {
      validateRecallDocument(document);
      storage.setItem(key, JSON.stringify(document));
      return clone(document);
    },
    async reset() {
      seeded = false;
      storage.removeItem(key);
    },
  };
}

export type RecallPrototypeRepository = ReturnType<typeof createRecallPrototypeRepository>;

export type RecallPrototypeFixture = {
  episode: TradeEpisode;
  candles: Candle[];
  mode: RecallPrototypeMode;
  repository: RecallPrototypeRepository;
};

const prototypeInstrument = {
  id: "CN-SH:REVIEW-DEMO",
  symbol: "REVIEW",
  name: "复盘样板",
  market: "CN-SH",
  currency: "CNY",
} as const;

function prototypeDate(index: number, hour = 0) {
  return new Date(Date.UTC(2026, 0, 1 + index, hour)).toISOString();
}

export function createRecallPrototypeFixture(
  mode: RecallPrototypeMode = "recommended",
  storage?: RecallPrototypeStorage,
): RecallPrototypeFixture {
  const candles: Candle[] = Array.from({ length: 100 }, (_, index) => {
    const wave = Math.sin(index / 4) * 2.4;
    const base = index < 59 ? 49 + index * 0.11 + wave : index < 68 ? 56 + (index - 59) * 1.1 + wave : 65 - (index - 68) * 0.18 + wave;
    const open = Number(base.toFixed(2));
    const close = Number((base + Math.sin(index * 1.7) * 1.2).toFixed(2));
    return {
      time: prototypeDate(index),
      knowledgeAt: prototypeDate(index, 7),
      tradingDates: [prototypeDate(index).slice(0, 10)],
      open,
      high: Number((Math.max(open, close) + 1.8).toFixed(2)),
      low: Number((Math.min(open, close) - 1.2).toFixed(2)),
      close,
      volume: 100000 + index * 1300,
    };
  });
  const execution = (id: string, side: "buy" | "sell", index: number, quantity: string, price: string, row: number) => ({
    id,
    source: { platform: "review-design-prototype", row },
    accountId: "prototype-account",
    accountLabel: "样板账户（本地）",
    instrument: prototypeInstrument,
    side,
    // The synthetic daily bar is knowable at the Shanghai session cutoff
    // (15:00 local = 07:00Z); keep fills on that boundary so advancing the
    // replay reveals the intended bar and trade together.
    executedAt: prototypeDate(index, 7),
    quantity,
    price,
    fee: "0",
  });
  const episode: TradeEpisode = {
    id: "review-design-prototype-episode",
    accountId: "prototype-account",
    accountLabel: "样板账户（本地）",
    instrument: prototypeInstrument,
    direction: "long",
    status: "closed",
    startedAt: prototypeDate(59, 7),
    endedAt: prototypeDate(73, 7),
    openingQuantity: "1000",
    remainingQuantity: "0",
    executions: [
      execution("prototype-entry-d60", "buy", 59, "1000", "56", 1),
      execution("prototype-exit-d68", "sell", 67, "600", "64", 2),
      execution("prototype-exit-d74", "sell", 73, "400", "61", 3),
    ],
  };
  const memory = new Map<string, string>();
  const fallbackStorage: RecallPrototypeStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
  const repository = createRecallPrototypeRepository(storage ?? fallbackStorage, RECALL_PROTOTYPE_STORAGE_KEY, episode);
  return { episode, candles, mode, repository };
}

export function isRecallPrototypeStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const localStorage = window.localStorage;
    if (typeof localStorage === "undefined") return false;
    // Probe the single sample key and restore its previous value. Some
    // browsers expose localStorage while denying writes (private mode or a
    // blocked origin); those environments must remain explicitly in-memory.
    const previous = localStorage.getItem(RECALL_PROTOTYPE_STORAGE_KEY);
    localStorage.setItem(RECALL_PROTOTYPE_STORAGE_KEY, previous ?? "");
    if (previous === null) localStorage.removeItem(RECALL_PROTOTYPE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
