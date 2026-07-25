import { beforeEach, describe, expect, it } from "vitest";

import type { TradeEpisode } from "../trades/types";
import {
  loadImportedEpisodes,
  saveImportedEpisodes,
} from "./import-library";

const episode: TradeEpisode = {
  id: "acct:US:BABA:2025-03-12T16:38:57.000Z",
  accountId: "acct",
  accountLabel: "富途 · 0855",
  instrument: {
    id: "US:BABA",
    symbol: "BABA",
    name: "BABA",
    market: "US",
    currency: "USD",
  },
  direction: "long",
  status: "open",
  startedAt: "2025-03-12T16:38:57.000Z",
  openingQuantity: "20",
  remainingQuantity: "20",
  executions: [
    {
      id: "fill-1",
      source: { platform: "futu", row: 2 },
      accountId: "acct",
      accountLabel: "富途 · 0855",
      instrument: {
        id: "US:BABA",
        symbol: "BABA",
        name: "BABA",
        market: "US",
        currency: "USD",
      },
      side: "buy",
      executedAt: "2025-03-12T16:38:57.000Z",
      quantity: "20",
      price: "137.65",
      fee: "2.05",
    },
  ],
};

describe("import library storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips imported episodes and replaces duplicate ids", () => {
    saveImportedEpisodes([episode, { ...episode }]);

    expect(loadImportedEpisodes()).toEqual([episode]);
  });

  it("ignores malformed stored data", () => {
    window.localStorage.setItem(
      "trade-reviewer:imports:v1",
      JSON.stringify({ version: 1, episodes: [{ nope: true }] }),
    );

    expect(loadImportedEpisodes()).toEqual([]);
  });
});
