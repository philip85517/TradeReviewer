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

function emptyPaddleResult(width = 4, height = 3) {
  return {
    image: { width, height },
    items: [],
    metrics: {
      detMs: 1,
      recMs: 2,
      totalMs: 3,
      detectedBoxes: 0,
      recognizedCount: 0,
    },
    runtime: {
      requestedBackend: "wasm",
      detProvider: "wasm",
      recProvider: "wasm",
      webgpuAvailable: false,
    },
  };
}

function installFallbackImageDecode() {
  const image = {
    src: "",
    naturalWidth: 4,
    naturalHeight: 3,
    decode: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal(
    "Image",
    class {
      src = image.src;
      naturalWidth = image.naturalWidth;
      naturalHeight = image.naturalHeight;
      decode = image.decode;
    },
  );
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const createObjectURL = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:fallback");
  const revokeObjectURL = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  return { createObjectURL, drawImage, revokeObjectURL };
}

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
    vi.restoreAllMocks();
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

  it("decodes fallback Blob predictions through a disposable local canvas", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "createImageBitmap",
    );
    const { createObjectURL, drawImage, revokeObjectURL } =
      installFallbackImageDecode();
    const input = new Blob(["tile"], { type: "image/png" });
    let drawable:
      | (HTMLCanvasElement & { close(): void })
      | undefined;
    let dimensions: { width: number; height: number } | undefined;
    paddle.predict.mockImplementation(async (source: Blob) => {
      drawable = (await globalThis.createImageBitmap(
        source,
      )) as unknown as HTMLCanvasElement & { close(): void };
      dimensions = { width: drawable.width, height: drawable.height };
      drawable.close();
      drawable.close();
      return [emptyPaddleResult()];
    });
    const engine = await createLocalOcrEngine();

    await expect(engine.recognize(input)).resolves.toMatchObject({
      width: 4,
      height: 3,
    });

    expect(dimensions).toEqual({ width: 4, height: 3 });
    expect(createObjectURL).toHaveBeenCalledWith(input);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fallback");
    expect(drawable).toMatchObject({ width: 0, height: 0 });
    expect(globalThis.createImageBitmap).toBeUndefined();
    expect(
      Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap"),
    ).toEqual(previousDescriptor);
  });

  it("restores the global and cleans the fallback canvas when prediction rejects", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const { revokeObjectURL } = installFallbackImageDecode();
    let drawable:
      | (HTMLCanvasElement & { close(): void })
      | undefined;
    paddle.predict.mockImplementation(async (source: Blob) => {
      drawable = (await globalThis.createImageBitmap(
        source,
      )) as unknown as HTMLCanvasElement & { close(): void };
      throw new Error("prediction failed");
    });
    const engine = await createLocalOcrEngine();

    await expect(engine.recognize(new Blob(["tile"]))).rejects.toThrow(
      "prediction failed",
    );

    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(drawable).toMatchObject({ width: 0, height: 0 });
    expect(globalThis.createImageBitmap).toBeUndefined();
  });

  it("serializes fallback predictions while the global shim is installed", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const { revokeObjectURL } = installFallbackImageDecode();
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let predictionCount = 0;
    paddle.predict.mockImplementation(async (source: Blob) => {
      predictionCount += 1;
      if (predictionCount === 1) {
        markFirstStarted();
      }
      const drawable = (await globalThis.createImageBitmap(source)) as unknown as {
        close(): void;
      };
      try {
        if (predictionCount === 1) {
          await firstCanFinish;
        }
        return [emptyPaddleResult()];
      } finally {
        drawable.close();
      }
    });
    const engine = await createLocalOcrEngine();

    const first = engine.recognize(new Blob(["first"])).then(
      () => true,
      () => false,
    );
    await firstStarted;
    const second = engine.recognize(new Blob(["second"])).then(
      () => true,
      () => false,
    );
    await Promise.resolve();

    const callsBeforeRelease = paddle.predict.mock.calls.length;
    releaseFirst();
    const outcomes = await Promise.all([first, second]);

    expect(callsBeforeRelease).toBe(1);
    expect(outcomes).toEqual([true, true]);
    expect(paddle.predict).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(globalThis.createImageBitmap).toBeUndefined();
  });

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
