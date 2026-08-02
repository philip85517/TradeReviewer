import { describe, expect, it } from "vitest";
import {
  FUTU_SCREENSHOT_OCR,
  TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR,
  TIGER_SCREENSHOT_OCR,
  image,
  ocrLine,
} from "./__fixtures__/ocr-lines";
import {
  anchorTradeRows,
  detectScreenshotLayout,
} from "./layout-detector";

describe("screenshot layout detection", () => {
  it("keeps long-image trade rows within their local OCR line bands", () => {
    const rows = anchorTradeRows(
      image("long-local-rows", 1_220, 13_000, [
        ocrLine("买入", 20, 1_000, 80, 24),
        ocrLine("Alpha", 180, 1_000, 160, 24),
        ocrLine("unrelated", 180, 1_080, 160, 20),
        ocrLine("卖出", 20, 1_140, 80, 24),
        ocrLine("Beta", 180, 1_140, 160, 24),
      ]),
      {
        maximumNormalizedAnchorX: 0.15,
        minimumAnchorY: 0,
        isCorroboratingLine: (line) => line.sourceBounds.x >= 180,
      },
    );

    expect(rows.map((row) => row.side)).toEqual(["buy", "sell"]);
    expect(rows.map((row) => row.lines.map((line) => line.text))).toEqual([
      ["买入", "Alpha"],
      ["卖出", "Beta"],
    ]);
  });

  it("requires the independent Futu title, account, headers, and trade-row signals", () => {
    expect(detectScreenshotLayout(FUTU_SCREENSHOT_OCR)).toMatchObject({
      matched: true,
      broker: "futu",
      layoutVersion: "futu-orders-dark-v1",
    });
  });

  it("requires the independent Tiger title, account, headers, and trade-row signals", () => {
    expect(detectScreenshotLayout(TIGER_SCREENSHOT_OCR)).toMatchObject({
      matched: true,
      broker: "tiger",
      layoutVersion: "tiger-orders-dark-v1",
    });
  });

  it("does not identify an unbranded instrument-first layout from only one complete row", () => {
    expect(
      detectScreenshotLayout(
        image(
          "instrument-first-one-row",
          TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR.width,
          TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR.height,
          TIGER_INSTRUMENT_FIRST_SCREENSHOT_OCR.lines.slice(0, 13),
        ),
      ),
    ).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
  });

  it("does not select a broker from a buy or sell label alone", () => {
    expect(
      detectScreenshotLayout(
        image("unknown", 800, 1_200, [
          ocrLine("买入", 10, 10, 50, 20),
        ]),
      ),
    ).toEqual({
      matched: false,
      code: "unsupported-screenshot-layout",
      message: "暂不支持该截图版式，请使用老虎或富途的交易历史截图",
    });
  });

  it("fails closed when complete evidence for both layouts is present", () => {
    expect(
      detectScreenshotLayout(
        image("ambiguous", 1_220, 2_000, [
          ...FUTU_SCREENSHOT_OCR.lines,
          ...TIGER_SCREENSHOT_OCR.lines,
        ]),
      ),
    ).toEqual({
      matched: false,
      code: "unsupported-screenshot-layout",
      message: "暂不支持该截图版式，请使用老虎或富途的交易历史截图",
    });
  });

  it("requires Futu completion evidence inside a side-anchored row", () => {
    expect(
      detectScreenshotLayout(
        image("detached-completion", 1_220, 2_000, [
          ...FUTU_SCREENSHOT_OCR.lines.slice(0, 6),
          ocrLine("卖出", 20, 390, 80, 24),
          ocrLine("全部成交", 20, 1_900, 120, 20),
        ]),
      ),
    ).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
  });

  it("does not accept Futu branding found only in a body company row", () => {
    expect(
      detectScreenshotLayout(
        image("futu-body-brand-spoof", 1_220, 2_000, [
          FUTU_SCREENSHOT_OCR.lines[0],
          ocrLine("账户", 470, 190, 120, 24),
          ...FUTU_SCREENSHOT_OCR.lines.slice(2, 8),
          ocrLine("FUTU HOLDINGS HK", 245, 390, 220, 24),
          ...FUTU_SCREENSHOT_OCR.lines.slice(9),
        ]),
      ),
    ).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
  });

  it("fails closed when Tiger quantity and price headers are swapped", () => {
    expect(
      detectScreenshotLayout(
        image("swapped-columns", 1_220, 2_000, [
          ocrLine("订单历史", 42, 110, 180, 30),
          ocrLine("Tiger Brokers · U2468", 430, 190, 300, 24),
          ocrLine("方向", 20, 310, 100, 22),
          ocrLine("名称/代码", 180, 310, 180, 22),
          ocrLine("成交数量", 780, 310, 150, 22),
          ocrLine("成交价格", 600, 310, 150, 22),
          ocrLine("成交时间", 1_000, 310, 170, 22),
          ocrLine("买入", 20, 390, 80, 24),
        ]),
      ),
    ).toMatchObject({
      matched: false,
      code: "unsupported-screenshot-layout",
    });
  });
});
