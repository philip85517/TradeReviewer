import { describe, expect, it } from "vitest";

import { buildTradeEpisodes } from "../trades/episodes";
import {
  NON_TIGER_PAGES,
  TIGER_IDENTICAL_FILL_PAGES,
  TIGER_PAGES,
  TIGER_SHORT_PAGES,
} from "./__fixtures__/tiger-pages";
import {
  detectTigerStatement,
  parseTigerPages,
  TigerStatementParser,
} from "./tiger";

const options = {
  fileName: "Tiger_2025.pdf",
  fileFingerprint: "tiger-fixture",
};

describe("Tiger PDF import", () => {
  it("requires both the broker heading and a stock table header", () => {
    expect(detectTigerStatement(TIGER_PAGES)).toMatchObject({
      matched: true,
    });
    expect(detectTigerStatement(NON_TIGER_PAGES)).toMatchObject({
      matched: false,
    });
  });

  it("imports long, short, and ETF rows without doubling display duplicates", () => {
    const result = parseTigerPages(TIGER_PAGES, options);

    expect(result.broker).toBe("tiger");
    expect(result.records).toHaveLength(5);
    expect(
      result.records.find(
        (execution) =>
          execution.instrument.symbol === "1810" &&
          execution.side === "sell",
      ),
    ).toMatchObject({
      side: "sell",
      quantity: "800",
      price: "51.8",
      fee: "5.8",
      instrument: {
        market: "HK",
        name: "小米集团-W",
        currency: "HKD",
      },
      source: {
        platform: "tiger",
        page: 1,
        sourceTimezone: "GMT+8",
        timePrecision: "second",
      },
    });
    expect(result.candidates).toContainEqual({
      market: "US",
      symbol: "SPY",
      sourceName: "SPDR S&P 500 ETF",
      sourceAssetType: "etf",
    });
    expect(result.exclusions).toContainEqual(
      expect.objectContaining({ category: "fund", count: 1 }),
    );
  });

  it("carries the stock section across a page break with a repeated header", () => {
    const pages = TIGER_PAGES.map((page, index) =>
      index === 1
        ? {
            ...page,
            items: page.items.filter((item) => item.text !== "股票交易"),
          }
        : page,
    );

    expect(parseTigerPages(pages, options).records).toHaveLength(5);
  });

  it("builds a closed short episode from short-open then close", () => {
    const result = parseTigerPages(TIGER_SHORT_PAGES, options);
    const [episode] = buildTradeEpisodes(result.records);

    expect(episode).toMatchObject({
      direction: "short",
      status: "closed",
      openingQuantity: "800",
      remainingQuantity: "0",
    });
  });

  it("keeps legitimate identical fills when the identity cells repeat", () => {
    const result = parseTigerPages(TIGER_IDENTICAL_FILL_PAGES, options);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
  });

  it("exposes an async parser adapter for the dispatcher", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const extractPages = async () => TIGER_SHORT_PAGES;
    const parser = new TigerStatementParser(extractPages);

    await expect(
      parser.detect({
        ...options,
        bytes,
      }),
    ).resolves.toMatchObject({ matched: true });
    await expect(
      parser.parse({
        ...options,
        bytes,
      }),
    ).resolves.toMatchObject({ broker: "tiger", blocked: false });
  });
});
