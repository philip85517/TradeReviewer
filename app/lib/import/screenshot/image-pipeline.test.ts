import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  OcrTextLine,
  ScreenshotInput,
  SourceBounds,
} from "./contracts";
import {
  mergeTechnicalDuplicateLines,
  planVerticalTiles,
  recognizeScreenshot,
} from "./image-pipeline";

function line(
  text: string,
  sourceBounds: SourceBounds,
  score = 0.95,
): OcrTextLine {
  const { x, y, width, height } = sourceBounds;
  return {
    text,
    score,
    polygon: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    sourceBounds,
  };
}

function screenshotInput(): ScreenshotInput {
  return {
    id: "screenshot-image:test",
    index: 0,
    file: new File(["image"], "capture.png", { type: "image/png" }),
    fingerprint: "test",
  };
}

function installCanvas(
  pixels: Uint8ClampedArray = new Uint8ClampedArray([0, 0, 0, 255]),
) {
  let outputPixels: Uint8ClampedArray | undefined;
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
      const requiredLength = width * height * 4;
      const data =
        pixels.length === requiredLength
          ? new Uint8ClampedArray(pixels)
          : new Uint8ClampedArray(requiredLength);
      for (let index = 3; index < data.length; index += 4) {
        data[index] = 255;
      }
      return { data, width, height };
    }),
    putImageData: vi.fn((imageData: ImageData) => {
      outputPixels = new Uint8ClampedArray(imageData.data);
    }),
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["processed"], { type: "image/png" })),
  );

  return {
    context,
    getOutputPixels: () => outputPixels,
  };
}

function bitmap(width: number, height: number) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("long screenshot image pipeline", () => {
  it.each([13_574, 7_409, 13_646])(
    "covers every source pixel of a %i px screenshot",
    (height) => {
      const tiles = planVerticalTiles(height, 2_048, 192);
      expect(tiles[0]).toEqual({ index: 0, y: 0, height: 2_048 });
      expect(tiles.at(-1)!.y + tiles.at(-1)!.height).toBe(height);
      for (let y = 0; y < height; y += 1) {
        expect(
          tiles.some((tile) => y >= tile.y && y < tile.y + tile.height),
        ).toBe(true);
      }
    },
  );

  it("merges only same-text lines with overlapping source coordinates", () => {
    expect(
      mergeTechnicalDuplicateLines([
        line("NVDA", { x: 120, y: 1_900, width: 90, height: 30 }, 0.91),
        line("NVDA", { x: 121, y: 1_901, width: 89, height: 30 }, 0.97),
        line("NVDA", { x: 120, y: 2_100, width: 90, height: 30 }, 0.96),
      ]),
    ).toEqual([
      line("NVDA", { x: 121, y: 1_901, width: 89, height: 30 }, 0.97),
      line("NVDA", { x: 120, y: 2_100, width: 90, height: 30 }, 0.96),
    ]);
  });

  it("maps tile polygons and bounds back to source coordinates", async () => {
    installCanvas();
    const sourceBitmap = bitmap(10, 2_100);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(sourceBitmap));
    const onProgress = vi.fn();
    const recognize = vi
      .fn()
      .mockResolvedValueOnce({ width: 10, height: 2_048, lines: [] })
      .mockResolvedValueOnce({
        width: 10,
        height: 244,
        lines: [
          line("AAPL", { x: 1, y: 10, width: 8, height: 20 }, 0.96),
        ],
      });

    const result = await recognizeScreenshot(
      screenshotInput(),
      { recognize, dispose: vi.fn() },
      { signal: new AbortController().signal, onProgress },
    );

    expect(result).toEqual({
      imageId: "screenshot-image:test",
      width: 10,
      height: 2_100,
      lines: [
        line("AAPL", { x: 1, y: 1_866, width: 8, height: 20 }, 0.96),
      ],
    });
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("stops before later tiles after cancellation", async () => {
    installCanvas();
    const sourceBitmap = bitmap(2, 4_100);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(sourceBitmap));
    const controller = new AbortController();
    const recognize = vi.fn().mockImplementation(async () => {
      controller.abort();
      return { width: 2, height: 2_048, lines: [] };
    });

    await expect(
      recognizeScreenshot(
        screenshotInput(),
        { recognize, dispose: vi.fn() },
        { signal: controller.signal, onProgress: vi.fn() },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(recognize).toHaveBeenCalledTimes(1);
    expect(sourceBitmap.close).toHaveBeenCalledTimes(1);
  });

  it("does not start OCR when cancellation arrives during tile encoding", async () => {
    installCanvas();
    let finishEncoding: BlobCallback | undefined;
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(
      (callback) => {
        finishEncoding = callback;
      },
    );
    const sourceBitmap = bitmap(2, 2);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(sourceBitmap));
    const controller = new AbortController();
    const recognize = vi
      .fn()
      .mockResolvedValue({ width: 2, height: 2, lines: [] });

    const result = recognizeScreenshot(
      screenshotInput(),
      { recognize, dispose: vi.fn() },
      { signal: controller.signal, onProgress: vi.fn() },
    );
    await vi.waitFor(() => expect(finishEncoding).toBeTypeOf("function"));

    controller.abort();
    finishEncoding!(new Blob(["processed"], { type: "image/png" }));

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(recognize).not.toHaveBeenCalled();
    expect(sourceBitmap.close).toHaveBeenCalledTimes(1);
  });

  it("grayscales, inverts dark pixels, and stretches contrast deterministically", async () => {
    const { getOutputPixels } = installCanvas(
      new Uint8ClampedArray([
        10, 10, 10, 255, 110, 110, 110, 255,
      ]),
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(bitmap(2, 1)),
    );

    await recognizeScreenshot(
      screenshotInput(),
      {
        recognize: vi
          .fn()
          .mockResolvedValue({ width: 2, height: 1, lines: [] }),
        dispose: vi.fn(),
      },
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(getOutputPixels()).toEqual(
      new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
    );
  });

  it("releases each decoded bitmap and fallback object URL exactly once", async () => {
    installCanvas();
    const sourceBitmap = bitmap(1, 1);
    const recognize = vi
      .fn()
      .mockResolvedValue({ width: 1, height: 1, lines: [] });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(sourceBitmap));

    await recognizeScreenshot(
      screenshotInput(),
      { recognize, dispose: vi.fn() },
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(sourceBitmap.close).toHaveBeenCalledTimes(1);

    vi.stubGlobal("createImageBitmap", undefined);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 1;
        naturalHeight = 1;
        decode = vi.fn().mockResolvedValue(undefined);
      },
    );

    await recognizeScreenshot(
      screenshotInput(),
      { recognize, dispose: vi.fn() },
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
