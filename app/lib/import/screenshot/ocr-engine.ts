import type { OcrTextLine, SourceBounds } from "./contracts";

export type LocalOcrEngine = {
  recognize(input: Blob): Promise<{
    width: number;
    height: number;
    lines: OcrTextLine[];
  }>;
  dispose(): Promise<void>;
};

const DETECTION_MODEL_URL =
  "/ocr/models/PP-OCRv5_mobile_det_onnx_infer.tar";
const RECOGNITION_MODEL_URL =
  "/ocr/models/PP-OCRv5_mobile_rec_onnx_infer.tar";

type BitmapCompatibilityCanvas = HTMLCanvasElement & {
  close(): void;
};

let fallbackPredictionTail: Promise<void> = Promise.resolve();
let fallbackShimInstalled = false;

function serializeFallbackPrediction<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = fallbackPredictionTail.then(operation);
  fallbackPredictionTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function decodeBlobToCompatibilityCanvas(
  input: Blob,
): Promise<BitmapCompatibilityCanvas> {
  const objectUrl = URL.createObjectURL(input);
  const image = new Image();
  let canvas: HTMLCanvasElement | undefined;
  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    URL.revokeObjectURL(objectUrl);
    image.src = "";
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  try {
    image.src = objectUrl;
    await image.decode();
    canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D rendering is unavailable");
    }
    context.drawImage(image, 0, 0);
    Object.defineProperty(canvas, "close", {
      configurable: true,
      value: close,
    });
    return canvas as BitmapCompatibilityCanvas;
  } catch (error) {
    close();
    throw error;
  }
}

async function withCreateImageBitmapCompatibility<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previousDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  const drawables = new Set<BitmapCompatibilityCanvas>();
  const compatibilityCreateImageBitmap = async (source: ImageBitmapSource) => {
    if (!(source instanceof Blob)) {
      throw new TypeError(
        "The createImageBitmap compatibility path accepts Blob input only",
      );
    }
    const drawable = await decodeBlobToCompatibilityCanvas(source);
    drawables.add(drawable);
    return drawable as unknown as ImageBitmap;
  };

  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    writable: true,
    value: compatibilityCreateImageBitmap,
  });
  fallbackShimInstalled = true;
  try {
    return await operation();
  } finally {
    try {
      for (const drawable of drawables) {
        drawable.close();
      }
    } finally {
      if (previousDescriptor) {
        Object.defineProperty(
          globalThis,
          "createImageBitmap",
          previousDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, "createImageBitmap");
      }
      fallbackShimInstalled = false;
    }
  }
}

function polygonBounds(
  polygon: Array<{ x: number; y: number }>,
): SourceBounds {
  const xs = polygon.map(({ x }) => x);
  const ys = polygon.map(({ y }) => y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

export async function createLocalOcrEngine(): Promise<LocalOcrEngine> {
  const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
  const needsCreateImageBitmapCompatibility =
    typeof createImageBitmap !== "function" || fallbackShimInstalled;
  const supportsWorkerImages =
    typeof ImageBitmap !== "undefined" &&
    !needsCreateImageBitmapCompatibility;
  const paddle = await PaddleOCR.create({
    textDetectionModelName: "PP-OCRv5_mobile_det",
    textDetectionModelAsset: {
      url: DETECTION_MODEL_URL,
    },
    textRecognitionModelName: "PP-OCRv5_mobile_rec",
    textRecognitionModelAsset: {
      url: RECOGNITION_MODEL_URL,
    },
    worker: supportsWorkerImages,
    ortOptions: {
      backend: "wasm",
      wasmPaths: "/ocr/ort/",
      numThreads: 1,
      simd: true,
    },
  });
  let disposePromise: Promise<void> | undefined;

  return {
    async recognize(input) {
      const prediction = needsCreateImageBitmapCompatibility
        ? serializeFallbackPrediction(() =>
            withCreateImageBitmapCompatibility(() => paddle.predict(input)),
          )
        : paddle.predict(input);
      const [result] = await prediction;
      if (!result) {
        throw new Error("PaddleOCR returned no image result");
      }
      const lines: OcrTextLine[] = result.items.map((item) => {
        const polygon = item.poly.map(([x, y]) => ({ x, y }));
        return {
          text: item.text,
          score: item.score,
          polygon,
          sourceBounds: polygonBounds(polygon),
        };
      });
      return {
        width: result.image.width,
        height: result.image.height,
        lines,
      };
    },
    dispose() {
      disposePromise ??= paddle.dispose();
      return disposePromise;
    },
  };
}
