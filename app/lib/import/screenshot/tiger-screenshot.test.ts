import { describe, expect, it } from "vitest";
import {
  FUTU_SCREENSHOT_OCR,
  TIGER_SCREENSHOT_OCR,
  image,
  ocrLine,
} from "./__fixtures__/ocr-lines";
import { parseTigerScreenshot } from "./tiger-screenshot";

const TIGER_LAYOUT_LINES = TIGER_SCREENSHOT_OCR.lines.slice(0, 7);

describe("Tiger dark order-history screenshots", () => {
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
      sourceName: "NVIDIA",
      side: "buy",
      quantity: "10",
      price: "120.5",
      sourceTimestampText: "2024/06/05 14:39:25",
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
      sourceName: "APPLE",
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
      sourceName: "APPLE",
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
