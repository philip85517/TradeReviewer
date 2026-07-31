import type {
  OcrImageResult,
  OcrTextLine,
  ScreenshotInput,
  SourceBounds,
} from "./contracts";
import { validateDecodedDimensions } from "./image-input";
import type { LocalOcrEngine } from "./ocr-engine";

const DEFAULT_MAX_TILE_HEIGHT = 2_048;
const DEFAULT_TILE_OVERLAP = 192;

export type VerticalTile = {
  index: number;
  y: number;
  height: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
};

export function planVerticalTiles(
  imageHeight: number,
  maxTileHeight = DEFAULT_MAX_TILE_HEIGHT,
  overlap = DEFAULT_TILE_OVERLAP,
): VerticalTile[] {
  if (imageHeight <= 0) {
    return [];
  }
  if (maxTileHeight <= 0 || overlap < 0 || overlap >= maxTileHeight) {
    throw new RangeError("Invalid vertical tile dimensions");
  }

  const tiles: VerticalTile[] = [];
  const step = maxTileHeight - overlap;
  for (let y = 0; y < imageHeight; y += step) {
    tiles.push({
      index: tiles.length,
      y,
      height: Math.min(maxTileHeight, imageHeight - y),
    });
  }
  return tiles;
}

function boundsOverlap(left: SourceBounds, right: SourceBounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function mergeTechnicalDuplicateLines(
  lines: readonly OcrTextLine[],
): OcrTextLine[] {
  const merged: OcrTextLine[] = [];

  for (const candidate of lines) {
    const duplicateIndex = merged.findIndex(
      (existing) =>
        existing.text === candidate.text &&
        boundsOverlap(existing.sourceBounds, candidate.sourceBounds),
    );
    if (duplicateIndex === -1) {
      merged.push(candidate);
    } else if (candidate.score > merged[duplicateIndex].score) {
      merged[duplicateIndex] = candidate;
    }
  }

  return merged;
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }
}

function releaseOnce(release: () => void): () => void {
  let released = false;
  return () => {
    if (!released) {
      released = true;
      release();
    }
  };
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const imageBitmap = await createImageBitmap(file);
    return {
      source: imageBitmap,
      width: imageBitmap.width,
      height: imageBitmap.height,
      release: releaseOnce(() => imageBitmap.close()),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: releaseOnce(() => URL.revokeObjectURL(objectUrl)),
  };
}

function preprocessPixels(imageData: ImageData): void {
  const { data } = imageData;
  const pixelCount = data.length / 4;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 4_096));
  let sampledLuminance = 0;
  let sampleCount = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const luminance = Math.round(
      data[offset] * 0.299 +
        data[offset + 1] * 0.587 +
        data[offset + 2] * 0.114,
    );
    data[offset] = luminance;
    data[offset + 1] = luminance;
    data[offset + 2] = luminance;
    if (pixel % sampleStep === 0) {
      sampledLuminance += luminance;
      sampleCount += 1;
    }
  }

  const invert = sampledLuminance / sampleCount < 128;
  let minimum = 255;
  let maximum = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const luminance = invert ? 255 - data[offset] : data[offset];
    data[offset] = luminance;
    data[offset + 1] = luminance;
    data[offset + 2] = luminance;
    minimum = Math.min(minimum, luminance);
    maximum = Math.max(maximum, luminance);
  }

  if (maximum === minimum) {
    return;
  }

  const scale = 255 / (maximum - minimum);
  for (let offset = 0; offset < data.length; offset += 4) {
    const stretched = Math.round((data[offset] - minimum) * scale);
    data[offset] = stretched;
    data[offset + 1] = stretched;
    data[offset + 2] = stretched;
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode the OCR tile"));
      }
    }, "image/png");
  });
}

async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  engine: LocalOcrEngine,
  signal: AbortSignal,
): ReturnType<LocalOcrEngine["recognize"]> {
  const processedTile = await canvasBlob(canvas);
  abortIfNeeded(signal);
  return engine.recognize(processedTile);
}

function remapLine(line: OcrTextLine, tileY: number): OcrTextLine {
  return {
    ...line,
    polygon: line.polygon.map(({ x, y }) => ({ x, y: y + tileY })),
    sourceBounds: {
      ...line.sourceBounds,
      y: line.sourceBounds.y + tileY,
    },
  };
}

export async function recognizeScreenshot(
  input: ScreenshotInput,
  engine: LocalOcrEngine,
  options: {
    signal: AbortSignal;
    onProgress(completedTiles: number, totalTiles: number): void;
  },
): Promise<OcrImageResult> {
  abortIfNeeded(options.signal);
  const decoded = await decodeImage(input.file);

  try {
    abortIfNeeded(options.signal);
    validateDecodedDimensions(decoded.width, decoded.height);
    const tiles = planVerticalTiles(decoded.height);
    const lines: OcrTextLine[] = [];

    for (const tile of tiles) {
      abortIfNeeded(options.signal);
      const canvas = document.createElement("canvas");
      canvas.width = decoded.width;
      canvas.height = tile.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Canvas 2D rendering is unavailable");
      }
      context.drawImage(
        decoded.source,
        0,
        tile.y,
        decoded.width,
        tile.height,
        0,
        0,
        decoded.width,
        tile.height,
      );
      const pixels = context.getImageData(
        0,
        0,
        decoded.width,
        tile.height,
      );
      preprocessPixels(pixels);
      context.putImageData(pixels, 0, 0);

      const result = await recognizeCanvas(canvas, engine, options.signal);
      abortIfNeeded(options.signal);
      lines.push(...result.lines.map((line) => remapLine(line, tile.y)));
      options.onProgress(tile.index + 1, tiles.length);
    }

    return {
      imageId: input.id,
      width: decoded.width,
      height: decoded.height,
      lines: mergeTechnicalDuplicateLines(lines),
    };
  } finally {
    decoded.release();
  }
}
