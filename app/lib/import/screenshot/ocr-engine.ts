import { PaddleOCR } from "@paddleocr/paddleocr-js";
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
  const supportsWorkerImages =
    typeof ImageBitmap !== "undefined" &&
    typeof createImageBitmap === "function";
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
      const [result] = await paddle.predict(input);
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
