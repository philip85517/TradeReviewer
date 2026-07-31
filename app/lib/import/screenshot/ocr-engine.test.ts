import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const paddle = vi.hoisted(() => ({
  create: vi.fn(),
  predict: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("@paddleocr/paddleocr-js", () => ({
  PaddleOCR: {
    create: paddle.create,
  },
}));

import { createLocalOcrEngine } from "./ocr-engine";

describe("same-origin PaddleOCR adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("ImageBitmap", class {});
    vi.stubGlobal("createImageBitmap", vi.fn());
    paddle.create.mockReset();
    paddle.predict.mockReset();
    paddle.dispose.mockReset();
    paddle.create.mockResolvedValue({
      predict: paddle.predict,
      dispose: paddle.dispose,
    });
    paddle.dispose.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a worker-backed WASM engine with same-origin assets", async () => {
    await createLocalOcrEngine();

    expect(paddle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        textDetectionModelName: "PP-OCRv5_mobile_det",
        textDetectionModelAsset: {
          url: "/ocr/models/PP-OCRv5_mobile_det_onnx_infer.tar",
        },
        textRecognitionModelName: "PP-OCRv5_mobile_rec",
        textRecognitionModelAsset: {
          url: "/ocr/models/PP-OCRv5_mobile_rec_onnx_infer.tar",
        },
        worker: true,
        ortOptions: expect.objectContaining({
          backend: "wasm",
          wasmPaths: "/ocr/ort/",
          numThreads: 1,
          simd: true,
        }),
      }),
    );
  });

  it.each(["ImageBitmap", "createImageBitmap"])(
    "uses the browser-local main thread when %s is unavailable",
    async (capability) => {
      vi.stubGlobal(capability, undefined);

      await createLocalOcrEngine();

      expect(paddle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          worker: false,
          ortOptions: expect.objectContaining({
            backend: "wasm",
            wasmPaths: "/ocr/ort/",
          }),
        }),
      );
    },
  );

  it("maps PaddleOCR poly, text, and score into source lines", async () => {
    paddle.predict.mockResolvedValue([
      {
        image: { width: 800, height: 600 },
        items: [
          {
            poly: [
              [12, 20],
              [112, 18],
              [114, 48],
              [14, 50],
            ],
            text: "成交价 208.31",
            score: 0.97,
          },
        ],
        metrics: {
          detMs: 1,
          recMs: 2,
          totalMs: 3,
          detectedBoxes: 1,
          recognizedCount: 1,
        },
        runtime: {
          requestedBackend: "wasm",
          detProvider: "wasm",
          recProvider: "wasm",
          webgpuAvailable: false,
        },
      },
    ]);
    const input = new Blob(["tile"], { type: "image/png" });
    const engine = await createLocalOcrEngine();

    await expect(engine.recognize(input)).resolves.toEqual({
      width: 800,
      height: 600,
      lines: [
        {
          text: "成交价 208.31",
          score: 0.97,
          polygon: [
            { x: 12, y: 20 },
            { x: 112, y: 18 },
            { x: 114, y: 48 },
            { x: 14, y: 50 },
          ],
          sourceBounds: { x: 12, y: 18, width: 102, height: 32 },
        },
      ],
    });
    expect(paddle.predict).toHaveBeenCalledWith(input);
  });

  it("forwards disposal exactly once", async () => {
    const engine = await createLocalOcrEngine();

    await Promise.all([engine.dispose(), engine.dispose()]);

    expect(paddle.dispose).toHaveBeenCalledTimes(1);
  });
});
