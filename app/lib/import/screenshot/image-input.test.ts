import { describe, expect, expectTypeOf, it } from "vitest";
import {
  buildScreenshotBatchId,
  buildScreenshotInputs,
  validateDecodedDimensions,
  validateScreenshotFiles,
} from "./image-input";
import type { ScreenshotInput } from "./contracts";
import type { TradeExecution } from "../../trades/types";

describe("screenshot image input", () => {
  it("accepts an ordered JPG/PNG/WebP batch", () => {
    const files = [
      new File(["a"], "01.jpg", { type: "image/jpeg" }),
      new File(["b"], "02.png", { type: "image/png" }),
      new File(["c"], "03.webp", { type: "image/webp" }),
    ];

    expect(validateScreenshotFiles(files)).toEqual({
      ok: true,
      files,
    });
  });

  it.each([
    ["empty", []],
    [
      "too-many",
      Array.from(
        { length: 21 },
        (_, index) =>
          new File(["x"], `${index}.jpg`, { type: "image/jpeg" }),
      ),
    ],
    ["unsupported-type", [new File(["x"], "a.heic", { type: "image/heic" })]],
  ])("rejects %s input before OCR", (code, files) => {
    expect(validateScreenshotFiles(files)).toMatchObject({
      ok: false,
      code,
    });
  });

  it("uses an extension only when a browser omits the MIME type", () => {
    expect(
      validateScreenshotFiles([new File(["x"], "capture.PNG")]),
    ).toMatchObject({ ok: true });
    expect(
      validateScreenshotFiles([
        new File(["x"], "capture.jpg", { type: "image/heic" }),
      ]),
    ).toMatchObject({ ok: false, code: "unsupported-type" });
  });

  it("rejects a compressed image above 25 MiB", () => {
    const file = new File(
      [new Uint8Array(25 * 1024 * 1024 + 1)],
      "too-large.jpg",
      { type: "image/jpeg" },
    );

    expect(validateScreenshotFiles([file])).toMatchObject({
      ok: false,
      code: "file-too-large",
      fileName: "too-large.jpg",
    });
  });

  it("rejects a decoded image above 60 million pixels", () => {
    expect(() => validateDecodedDimensions(10_000, 6_001)).toThrow(
      "图片像素超过 6000 万",
    );
  });

  it("derives byte-based image IDs in selection order", async () => {
    const inputs = await buildScreenshotInputs([
      new File(["same"], "first.jpg", { type: "image/jpeg" }),
      new File(["same"], "renamed.png", { type: "image/png" }),
    ]);

    expect(inputs).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^screenshot-image:[0-9a-f]{16}$/),
        index: 0,
        fingerprint: expect.any(String),
      }),
      expect.objectContaining({
        id: expect.stringMatching(/^screenshot-image:[0-9a-f]{16}$/),
        index: 1,
        fingerprint: expect.any(String),
      }),
    ]);
    expect(inputs[0].fingerprint).toBe(inputs[1].fingerprint);
    expect(inputs[0].id).toBe(inputs[1].id);
  });

  it("derives an order-sensitive batch ID from selected image fingerprints", () => {
    const first: ScreenshotInput = {
      id: "screenshot-image:first",
      index: 0,
      file: new File(["a"], "a.jpg", { type: "image/jpeg" }),
      fingerprint: "first",
    };
    const second: ScreenshotInput = {
      id: "screenshot-image:second",
      index: 1,
      file: new File(["b"], "b.jpg", { type: "image/jpeg" }),
      fingerprint: "second",
    };

    expect(buildScreenshotBatchId([first, second])).toBe(
      "screenshot-batch:d56a0f87a3fa6194",
    );
    expect(buildScreenshotBatchId([first, second])).not.toBe(
      buildScreenshotBatchId([second, first]),
    );
  });

  it("keeps statement sources compatible and permits screenshot source evidence", () => {
    const legacyExecution: TradeExecution = {
      id: "legacy",
      source: { platform: "futu", row: 1 },
      accountId: "account",
      accountLabel: "Account",
      instrument: {
        id: "US:AAPL",
        symbol: "AAPL",
        name: "Apple",
        market: "US",
        currency: "USD",
      },
      side: "buy",
      executedAt: "2024-01-01T00:00:00Z",
      quantity: "1",
      price: "1",
      fee: "0",
    };
    const screenshotExecution: TradeExecution = {
      ...legacyExecution,
      id: "screenshot",
      source: {
        platform: "futu",
        row: 1,
        inputKind: "screenshot",
        batchId: "screenshot-batch:1234",
        captureIndex: 0,
        sourceBounds: { x: 10, y: 20, width: 30, height: 40 },
      },
    };

    expectTypeOf(legacyExecution).toMatchTypeOf<TradeExecution>();
    expectTypeOf(screenshotExecution).toMatchTypeOf<TradeExecution>();
  });
});
