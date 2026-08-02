import { describe, expect, it } from "vitest";
import {
  FUTU_SCREENSHOT_OCR,
  TIGER_BRANDED_INSTRUMENT_FIRST_ONE_ROW_OCR,
  TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR,
  TIGER_SCREENSHOT_OCR,
  TIGER_UNBRANDED_SCREENSHOT_OCR,
  image,
  ocrLine,
} from "./__fixtures__/ocr-lines";
import { detectScreenshotLayout } from "./layout-detector";
import { parseTigerScreenshot } from "./tiger-screenshot";

const TIGER_LAYOUT_LINES = TIGER_SCREENSHOT_OCR.lines.slice(0, 7);

describe("Tiger dark order-history screenshots", () => {
  it("pairs jittered timestamp boxes by closest vertical center", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-jittered-timestamps", 1_220, 13_000, [
        ...TIGER_SCREENSHOT_OCR.lines.slice(0, 12),
        ocrLine("2024/06/05", 1_010, 390, 150, 22),
        ocrLine("14:39:25", 1_010, 389, 130, 22),
        ocrLine("2025/06/06", 1_010, 436, 150, 22),
        ocrLine("10:00:00", 1_010, 435, 130, 22),
      ]),
    );

    expect(draft).toMatchObject({
      sourceTimestampText: "2024/06/05 14:39:25",
      fieldEvidence: {
        executedAt: {
          rawText: "2024/06/05 14:39:25",
          sourceBounds: {
            x: 1_010,
            y: 389,
            width: 150,
            height: 23,
          },
        },
      },
    });
  });

  it("preserves internal OCR whitespace in timestamp source text and evidence", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-timestamp-whitespace", 1_220, 2_000, [
        ...TIGER_SCREENSHOT_OCR.lines.slice(0, 12),
        ocrLine("2024/  06/05", 1_010, 390, 150, 22),
        ocrLine("14:  39:25", 1_010, 425, 130, 22),
      ]),
    );

    expect(draft.sourceTimestampText).toBe(
      "2024/  06/05 14:  39:25",
    );
    expect(draft.fieldEvidence.executedAt?.rawText).toBe(
      "2024/  06/05 14:  39:25",
    );
  });

  it("selects one closest date and time pair from a broad timestamp band", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-multiple-timestamps", 1_220, 13_000, [
        ...TIGER_SCREENSHOT_OCR.lines.slice(0, 14),
        ocrLine("2025/06/06", 1_010, 436, 150, 22),
        ocrLine("10:00:00", 1_010, 458, 130, 20),
      ]),
    );

    expect(draft).toMatchObject({
      sourceTimestampText: "2025/06/06 10:00:00",
      fieldEvidence: {
        executedAt: {
          rawText: "2025/06/06 10:00:00",
          sourceBounds: {
            x: 1_010,
            y: 436,
            width: 150,
            height: 42,
          },
        },
      },
    });
  });

  it("detects and parses one instrument-first row with Tiger branding above the headers", () => {
    expect(
      detectScreenshotLayout(
        TIGER_BRANDED_INSTRUMENT_FIRST_ONE_ROW_OCR,
      ),
    ).toEqual({
      matched: true,
      broker: "tiger",
      layoutVersion: "tiger-instrument-first-dark-v1",
      confidence: 1,
    });
    expect(
      parseTigerScreenshot(
        TIGER_BRANDED_INSTRUMENT_FIRST_ONE_ROW_OCR,
      ),
    ).toEqual([
      expect.objectContaining({
        broker: "tiger",
        layoutVersion: "tiger-instrument-first-dark-v1",
        sourceAccountSuffix: undefined,
        sourceName: "Example Systems",
        market: "US",
        symbol: "DEMO",
        side: "sell",
        quantity: "3",
        price: "42.5",
        sourceTimestampText: "2024/01/02 09:30:00",
      }),
    ]);
  });

  it("parses a structurally complete instrument-first Tiger row", () => {
    expect(
      detectScreenshotLayout(TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR),
    ).toMatchObject({
      matched: true,
      broker: "tiger",
      layoutVersion: "tiger-instrument-first-dark-v1",
    });
    expect(parseTigerScreenshot(TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR)).toEqual([
      expect.objectContaining({
        broker: "tiger",
        layoutVersion: "tiger-instrument-first-dark-v1",
        sourceAccountSuffix: undefined,
        sourceName: "Example Systems",
        market: "US",
        symbol: "DEMO",
        side: "sell",
        quantity: "3",
        price: "42.5",
        sourceTimestampText: "2024/01/02 09:30:00",
      }),
      expect.objectContaining({
        broker: "tiger",
        layoutVersion: "tiger-instrument-first-dark-v1",
        sourceName: "Sample Works",
        market: "US",
        symbol: "EXM2",
        side: "buy",
        quantity: "5",
        price: "21.25",
        sourceTimestampText: "2024/01/03 10:45:00",
      }),
    ]);
  });

  it("rejects a side-first Tiger-shaped layout without broker branding", () => {
    expect(detectScreenshotLayout(TIGER_UNBRANDED_SCREENSHOT_OCR)).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
    expect(parseTigerScreenshot(TIGER_UNBRANDED_SCREENSHOT_OCR)).toEqual([]);
  });

  it("does not treat a Tiger-like company name below the headers as broker branding", () => {
    const screenshot = image("unbranded-tiger-company", 1_220, 2_000, [
      ...TIGER_UNBRANDED_SCREENSHOT_OCR.lines.slice(0, 7),
      ocrLine("Tiger Example Holdings", 180, 390, 250, 24),
      ...TIGER_UNBRANDED_SCREENSHOT_OCR.lines.slice(8),
    ]);

    expect(detectScreenshotLayout(screenshot)).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
    expect(parseTigerScreenshot(screenshot)).toEqual([]);
  });

  it("does not promote an uppercase company name when the lower ticker OCR is corrupt", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-corrupt-ticker", 1_220, 2_000, [
        ...TIGER_SCREENSHOT_OCR.lines.slice(0, 8),
        ocrLine("TESLA", 180, 390, 180, 24),
        ocrLine("T3S?", 180, 425, 100, 20),
        ...TIGER_SCREENSHOT_OCR.lines.slice(10),
      ]),
    );

    expect(draft).toMatchObject({
      market: undefined,
      symbol: undefined,
      sourceName: "TESLA",
    });
  });

  it("leaves an uppercase company and ticker pair unresolved as ambiguous", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-ambiguous-ticker", 1_220, 2_000, [
        ...TIGER_SCREENSHOT_OCR.lines.slice(0, 8),
        ocrLine("EXAMPLE", 180, 390, 180, 24),
        ocrLine("EXMP", 180, 425, 100, 20),
        ...TIGER_SCREENSHOT_OCR.lines.slice(10),
      ]),
    );

    expect(draft).toMatchObject({
      market: undefined,
      symbol: undefined,
      sourceName: "EXAMPLE",
    });
  });

  it("maps an anchored row to normalized fields, union bounds, and field evidence", () => {
    expect(parseTigerScreenshot(TIGER_SCREENSHOT_OCR)[0]).toEqual({
      id: "tiger-1:tiger:0",
      broker: "tiger",
      layoutVersion: "tiger-orders-dark-v1",
      imageId: "tiger-1",
      sourceRowIndex: 0,
      sourceBounds: {
        x: 20,
        y: 390,
        width: 1_140,
        height: 57,
      },
      market: "US",
      symbol: "NVDA",
      sourceName: "Nvidia",
      side: "buy",
      quantity: "10",
      price: "120.5",
      sourceTimestampText: "2024/06/05 14:39:25",
      sourceAccountSuffix: "U6789",
      fieldEvidence: {
        market: {
          rawText: "NVDA",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 180,
            y: 425,
            width: 100,
            height: 20,
          },
        },
        symbol: {
          rawText: "NVDA",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 180,
            y: 425,
            width: 100,
            height: 20,
          },
        },
        side: {
          rawText: "买入",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 20,
            y: 390,
            width: 80,
            height: 24,
          },
        },
        quantity: {
          rawText: "10",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 620,
            y: 390,
            width: 80,
            height: 24,
          },
        },
        price: {
          rawText: "120.50",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 800,
            y: 390,
            width: 100,
            height: 24,
          },
        },
        executedAt: {
          rawText: "2024/06/05 14:39:25",
          confidence: 0.96,
          repaired: false,
          confirmedByUser: false,
          sourceBounds: {
            x: 1_010,
            y: 390,
            width: 150,
            height: 57,
          },
        },
      },
    });
  });

  it("does not guess an account suffix from arbitrary header digits", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-unmasked-account", 1_220, 2_000, [
        TIGER_SCREENSHOT_OCR.lines[0],
        ocrLine("Tiger Brokers report 2024", 430, 190, 300, 24),
        ...TIGER_SCREENSHOT_OCR.lines.slice(2),
      ]),
    );

    expect(draft.sourceAccountSuffix).toBeUndefined();
  });

  it("does not extract an account suffix from body or footer text", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-body-account", 1_220, 2_000, [
        TIGER_SCREENSHOT_OCR.lines[0],
        ocrLine("Tiger Brokers", 430, 190, 220, 24),
        ...TIGER_SCREENSHOT_OCR.lines.slice(2),
        ocrLine("Tiger Brokers · U9876", 430, 1_700, 300, 24),
      ]),
    );

    expect(draft.sourceAccountSuffix).toBeUndefined();
  });

  it("bounds suffix extraction with decorated detector header aliases", () => {
    const screenshot = image("tiger-decorated-headers", 1_220, 2_000, [
      TIGER_SCREENSHOT_OCR.lines[0],
      ocrLine("Tiger Brokers", 430, 190, 220, 24),
      ocrLine("方向：", 20, 310, 100, 22),
      ocrLine("名称/代码（证券）", 180, 310, 210, 22),
      ocrLine("成交数量:", 600, 310, 150, 22),
      ocrLine("成交价格：", 780, 310, 150, 22),
      ocrLine("成交时间（当地）", 1_000, 310, 190, 22),
      ...TIGER_SCREENSHOT_OCR.lines.slice(7),
      ocrLine("Tiger Brokers · U9876", 430, 1_700, 300, 24),
    ]);

    expect(detectScreenshotLayout(screenshot)).toMatchObject({
      matched: true,
      broker: "tiger",
    });
    expect(
      parseTigerScreenshot(screenshot)[0].sourceAccountSuffix,
    ).toBeUndefined();
  });

  it("keeps trades when a footer repeats a recognized header alias", () => {
    const screenshot = image("tiger-footer-header", 1_220, 2_000, [
      ...TIGER_SCREENSHOT_OCR.lines,
      ocrLine("成交时间（当地）", 1_000, 1_700, 190, 22),
    ]);

    expect(detectScreenshotLayout(screenshot)).toMatchObject({
      matched: true,
      broker: "tiger",
    });
    expect(
      parseTigerScreenshot(screenshot).map((draft) => draft.sourceName),
    ).toEqual(["Nvidia", "Apple"]);
  });

  it("does not turn navigation, headers, or footer text into drafts", () => {
    expect(
      parseTigerScreenshot(
        image("tiger-empty", 1_220, 2_000, [
          ...TIGER_LAYOUT_LINES,
          ocrLine("首页 订单 行情", 42, 1_900, 300, 22),
        ]),
      ),
    ).toEqual([]);
    expect(parseTigerScreenshot(TIGER_SCREENSHOT_OCR)).toHaveLength(2);
  });

  it("preserves a partially recognized anchored trade as one incomplete draft", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-partial", 1_220, 2_000, [
        ...TIGER_LAYOUT_LINES,
        ocrLine("卖出", 20, 390, 80, 24),
        ocrLine("Synthetic Holdings", 180, 390, 240, 24),
      ]),
    );

    expect(draft).toMatchObject({
      broker: "tiger",
      sourceRowIndex: 0,
      sourceName: "Synthetic Holdings",
      side: "sell",
      market: undefined,
      symbol: undefined,
      quantity: undefined,
      price: undefined,
      sourceTimestampText: undefined,
    });
  });

  it("does not promote a lone alphabetic company name to a ticker", () => {
    const [draft] = parseTigerScreenshot(
      image("tiger-name-only", 1_220, 2_000, [
        ...TIGER_LAYOUT_LINES,
        ...TIGER_SCREENSHOT_OCR.lines.slice(14, 16),
        ...TIGER_SCREENSHOT_OCR.lines.slice(17, 21),
      ]),
    );

    expect(draft).toMatchObject({
      sourceName: "Apple",
      market: undefined,
      symbol: undefined,
      quantity: "5",
      price: "12.05",
      sourceTimestampText: "2024/06/05 14:39:25",
    });
  });

  it.each(["买入", "卖出", "Buy", "Sell"])(
    "ignores an exact %s footer control even beside navigation text",
    (label) => {
      const drafts = parseTigerScreenshot(
        image(`tiger-footer-${label}`, 1_220, 2_000, [
          ...TIGER_SCREENSHOT_OCR.lines,
          ocrLine(label, 20, 1_850, 80, 24),
        ]),
      );

      expect(drafts).toHaveLength(2);
      expect(drafts.map((draft) => draft.symbol)).toEqual([
        "NVDA",
        "AAPL",
      ]);
    },
  );

  it("filters a close footer side control before it can truncate the final trade row", () => {
    const drafts = parseTigerScreenshot(
      image("tiger-close-footer", 1_220, 2_000, [
        ...TIGER_SCREENSHOT_OCR.lines,
        ocrLine("Buy", 20, 590, 80, 24),
      ]),
    );

    expect(drafts).toHaveLength(2);
    expect(drafts[1]).toMatchObject({
      sourceName: "Apple",
      symbol: "AAPL",
      side: "sell",
      quantity: "5",
      price: "12.05",
      sourceTimestampText: "2024/06/05 14:39:25",
    });
  });

  it("preserves two executions that occur in the same second", () => {
    const drafts = parseTigerScreenshot(TIGER_SCREENSHOT_OCR);

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.sourceTimestampText)).toEqual([
      "2024/06/05 14:39:25",
      "2024/06/05 14:39:25",
    ]);
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(2);
  });

  it("marks tested O/0 and I/1 numeric repairs and lowers their confidence", () => {
    const repaired = parseTigerScreenshot(TIGER_SCREENSHOT_OCR)[1];

    expect(repaired.price).toBe("12.05");
    expect(repaired.fieldEvidence.price).toMatchObject({
      rawText: "I2.O5",
      repaired: true,
      confirmedByUser: false,
    });
    expect(repaired.fieldEvidence.price!.confidence).toBeLessThan(0.85);
  });

  it("fails closed on a different broker layout", () => {
    expect(parseTigerScreenshot(FUTU_SCREENSHOT_OCR)).toEqual([]);
  });
});
