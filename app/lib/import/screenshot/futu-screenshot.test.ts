import { describe, expect, it } from "vitest";
import {
  FUTU_SCREENSHOT_OCR,
  FUTU_US_SCREENSHOT_OCR,
  TIGER_SCREENSHOT_OCR,
  image,
  ocrLine,
} from "./__fixtures__/ocr-lines";
import { parseFutuScreenshot } from "./futu-screenshot";
import { detectScreenshotLayout } from "./layout-detector";

describe("Futu dark order-history screenshots", () => {
  it("parses an alphabetic ticker from a complete Futu US row", () => {
    expect(parseFutuScreenshot(FUTU_US_SCREENSHOT_OCR)[0]).toMatchObject({
      broker: "futu",
      market: "US",
      symbol: "DEMO",
      sourceName: "Example Devices",
      side: "buy",
      quantity: "3",
      price: "42.5",
      sourceTimestampText: "2024/01/02 09:30:00",
    });
  });

  it("does not promote a lone alphabetic company name to a US ticker", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-us-name-only", 1_220, 2_000, [
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(0, 8),
        ocrLine("EXAMPLE", 245, 390, 150, 24),
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(10),
      ]),
    );

    expect(draft).toMatchObject({
      market: "US",
      symbol: undefined,
      sourceName: "EXAMPLE",
    });
  });

  it("does not promote an uppercase company name when the lower US ticker OCR is corrupt", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-us-corrupt-ticker", 1_220, 2_000, [
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(0, 8),
        ocrLine("TESLA", 245, 390, 150, 24),
        ocrLine("T3S?", 245, 425, 100, 20),
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(10),
      ]),
    );

    expect(draft).toMatchObject({
      market: "US",
      symbol: undefined,
      sourceName: "TESLA",
    });
  });

  it("leaves an uppercase company and ticker pair unresolved as ambiguous", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-us-ambiguous-ticker", 1_220, 2_000, [
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(0, 8),
        ocrLine("TESLA", 245, 390, 150, 24),
        ocrLine("TSLA", 245, 425, 100, 20),
        ...FUTU_US_SCREENSHOT_OCR.lines.slice(10),
      ]),
    );

    expect(draft).toMatchObject({
      market: "US",
      symbol: undefined,
      sourceName: "TESLA",
    });
  });

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

  it("does not extract an account suffix from body or footer text", () => {
    const [draft] = parseFutuScreenshot(
      image("futu-body-account", 1_220, 2_000, [
        FUTU_SCREENSHOT_OCR.lines[0],
        ocrLine("FUTU HK", 470, 190, 160, 24),
        ...FUTU_SCREENSHOT_OCR.lines.slice(2),
        ocrLine("FUTU · 9876", 470, 1_700, 180, 24),
      ]),
    );

    expect(draft.sourceAccountSuffix).toBeUndefined();
  });

  it("bounds suffix extraction with decorated detector header aliases", () => {
    const screenshot = image("futu-decorated-headers", 1_220, 2_000, [
      FUTU_SCREENSHOT_OCR.lines[0],
      ocrLine("FUTU HK", 470, 190, 160, 24),
      ocrLine("订单状态：", 20, 310, 150, 22),
      ocrLine("名称/代码（证券）", 245, 310, 210, 22),
      ocrLine("数量/价格:", 760, 310, 180, 22),
      ocrLine("成交时间（当地）", 1_020, 310, 190, 22),
      ...FUTU_SCREENSHOT_OCR.lines.slice(6),
      ocrLine("FUTU · 9876", 470, 1_700, 180, 24),
    ]);

    expect(detectScreenshotLayout(screenshot)).toMatchObject({
      matched: true,
      broker: "futu",
    });
    expect(
      parseFutuScreenshot(screenshot)[0].sourceAccountSuffix,
    ).toBeUndefined();
  });

  it("keeps trades when a footer repeats a recognized header alias", () => {
    const screenshot = image("futu-footer-header", 1_220, 2_000, [
      ...FUTU_SCREENSHOT_OCR.lines,
      ocrLine("成交时间（当地）", 1_000, 1_700, 190, 22),
    ]);

    expect(detectScreenshotLayout(screenshot)).toMatchObject({
      matched: true,
      broker: "futu",
    });
    expect(
      parseFutuScreenshot(screenshot).map((draft) => draft.sourceName),
    ).toEqual(["思摩尔国际", "腾讯控股"]);
  });
});
