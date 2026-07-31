export const SCREENSHOT_MAX_FILES = 20;
export const SCREENSHOT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const SCREENSHOT_MAX_PIXELS = 60_000_000;
export const SCREENSHOT_REVIEW_CONFIDENCE = 0.85;

export type ScreenshotInput = {
  id: string;
  index: number;
  file: File;
  fingerprint: string;
};

export type ScreenshotFileValidation =
  | { ok: true; files: readonly File[] }
  | {
      ok: false;
      code: "empty" | "too-many" | "unsupported-type" | "file-too-large";
      message: string;
      fileName?: string;
    };

export type ScreenshotField =
  | "market"
  | "symbol"
  | "side"
  | "quantity"
  | "price"
  | "executedAt";

export type SourceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrTextLine = {
  text: string;
  score: number;
  polygon: Array<{ x: number; y: number }>;
  sourceBounds: SourceBounds;
};

export type OcrImageResult = {
  imageId: string;
  width: number;
  height: number;
  lines: OcrTextLine[];
};

export type ScreenshotFieldEvidence = {
  rawText: string;
  confidence: number;
  repaired: boolean;
  confirmedByUser: boolean;
  sourceBounds?: SourceBounds;
};

export type ScreenshotTradeDraft = {
  id: string;
  broker: "futu" | "tiger";
  layoutVersion: string;
  imageId: string;
  sourceRowIndex: number;
  sourceBounds: SourceBounds;
  market?: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol?: string;
  sourceName?: string;
  side?: "buy" | "sell";
  quantity?: string;
  price?: string;
  sourceTimestampText?: string;
  sourceAccountSuffix?: string;
  timeDisambiguation?: "earlier" | "later";
  fieldEvidence: Partial<Record<ScreenshotField, ScreenshotFieldEvidence>>;
};
