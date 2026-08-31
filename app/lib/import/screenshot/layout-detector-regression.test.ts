import { describe, expect, it } from "vitest";
import { TIGER_FILLED_ORDERS_SCREENSHOT_OCR } from "./__fixtures__/ocr-lines";
import { detectScreenshotLayout } from "./layout-detector";

describe("Tiger filled-orders layout regression", () => {
  it("recognizes the historical compact filled-orders screenshot", () => {
    expect(
      detectScreenshotLayout(TIGER_FILLED_ORDERS_SCREENSHOT_OCR),
    ).toMatchObject({
      matched: true,
      broker: "tiger",
      layoutVersion: "tiger-filled-orders-dark-v1",
    });
  });
});
