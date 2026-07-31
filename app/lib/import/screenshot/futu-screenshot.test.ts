import { describe, expect, it } from "vitest";
import {
  FUTU_SCREENSHOT_OCR,
  TIGER_SCREENSHOT_OCR,
  image,
  ocrLine,
} from "./__fixtures__/ocr-lines";
import { parseFutuScreenshot } from "./futu-screenshot";

describe("Futu dark order-history screenshots", () => {
  it("keeps a market order incomplete instead of inventing a fill price", () => {
    expect(parseFutuScreenshot(FUTU_SCREENSHOT_OCR)[0]).toMatchObject({
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
      market: "HK",
      symbol: "6969",
      sourceName: "思摩尔国际",
      side: "sell",
      quantity: "4000",
      price: undefined,
      sourceTimestampText: "24/06/05 14:39:25",
      sourceAccountSuffix: "4321",
      fieldEvidence: {
        price: {
          rawText: "市价",
          repaired: false,
          confirmedByUser: false,
        },
      },
    });
  });

  it("normalizes a numeric limit price with Decimal.js", () => {
    expect(parseFutuScreenshot(FUTU_SCREENSHOT_OCR)[1]).toMatchObject({
      market: "HK",
      symbol: "700",
      sourceName: "腾讯控股",
      side: "buy",
      quantity: "200",
      price: "381.4",
      sourceTimestampText: "24/06/05 14:41:08",
      sourceRowIndex: 1,
    });
  });

  it("emits only the two anchored trade rows, excluding header and footer text", () => {
    const drafts = parseFutuScreenshot(FUTU_SCREENSHOT_OCR);

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.sourceName)).toEqual([
      "思摩尔国际",
      "腾讯控股",
    ]);
  });

  it("fails closed on a different broker layout", () => {
    expect(parseFutuScreenshot(TIGER_SCREENSHOT_OCR)).toEqual([]);
  });

  it("does not read the SH suffix inside CASH as a Shanghai market", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-cash", 1_220, 2_000, [
        FUTU_SCREENSHOT_OCR.lines[0],
        ocrLine("FUTU CASH · 4321", 470, 190, 240, 24),
        ...FUTU_SCREENSHOT_OCR.lines.slice(2),
      ]),
    );

    expect(draft).toMatchObject({
      market: undefined,
      symbol: undefined,
      sourceName: "思摩尔国际",
      quantity: "4000",
    });
  });

  it("does not guess an account suffix from arbitrary header digits", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-unmasked-account", 1_220, 2_000, [
        FUTU_SCREENSHOT_OCR.lines[0],
        ocrLine("FUTU HK report 2024", 470, 190, 240, 24),
        ...FUTU_SCREENSHOT_OCR.lines.slice(2),
      ]),
    );

    expect(draft.sourceAccountSuffix).toBeUndefined();
  });
});
